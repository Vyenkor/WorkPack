import fs from 'node:fs'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { z } from 'zod'
import { WorkPackService } from './service'

export type StorageKind = 'project' | 'template' | 'workspace'
export interface StorageLocations { project: string; template: string; workspace: string }
const locationsSchema = z.object({ project: z.string(), template: z.string(), workspace: z.string() })
function selectedDirectory(value: string) {
  if (!path.isAbsolute(value) || !fs.existsSync(value) || !fs.statSync(value).isDirectory()) throw new Error('请选择已存在的目录')
  return fs.realpathSync(value)
}
function digest(file: string) { return createHash('sha256').update(fs.readFileSync(file)).digest('hex') }

/** The pointer remains in userData; the database and template files can live elsewhere. */
export class StorageManager {
  readonly configPath: string
  readonly defaults: StorageLocations
  locations: StorageLocations
  service: WorkPackService
  constructor(systemDirectory: string, defaultProjectDirectory: string) {
    fs.mkdirSync(systemDirectory, { recursive: true })
    this.configPath = path.join(systemDirectory, 'storage.json')
    this.defaults = { project: defaultProjectDirectory, template: path.join(systemDirectory, 'templates'), workspace: systemDirectory }
    this.locations = fs.existsSync(this.configPath) ? locationsSchema.parse(JSON.parse(fs.readFileSync(this.configPath, 'utf8'))) : { ...this.defaults }
    for (const directory of Object.values(this.locations)) fs.mkdirSync(directory, { recursive: true })
    this.service = this.open(this.locations)
  }
  private open(locations: StorageLocations) {
    return new WorkPackService(locations.workspace, undefined, true, { templateRoot: locations.template, projectRoot: locations.project })
  }
  private write(locations: StorageLocations) {
    const temp = `${this.configPath}.${randomUUID()}.tmp`
    fs.writeFileSync(temp, JSON.stringify(locations, null, 2), { flag: 'wx' })
    try { fs.renameSync(temp, this.configPath) }
    catch (error) { fs.rmSync(temp, { force: true }); throw error }
  }
  change(kind: StorageKind, selected: string) {
    const directory = selectedDirectory(selected)
    if (directory === this.locations[kind]) return { ...this.locations }
    const next = { ...this.locations, [kind]: directory }
    if (kind === 'project') {
      this.write(next)
      this.locations = next
      this.service.projectRoot = directory
      return { ...this.locations }
    }
    if (kind === 'workspace') {
      const destination = path.join(directory, 'workpack-v3.sqlite')
      if (fs.existsSync(destination)) throw new Error('目标目录已有 WorkPack 数据库，请选择空目录')
      this.service.backupDatabase(destination)
      let reopened: WorkPackService | undefined
      try {
        reopened = this.open(next)
        this.write(next)
      } catch (error) {
        reopened?.close()
        fs.rmSync(destination, { force: true })
        throw error
      }
      this.service.close()
      this.service = reopened
      this.locations = next
      return { ...this.locations }
    }
    const sourceRoot = this.locations.template
    const assets = this.service.snapshot().templates.flatMap(template => template.assets)
    const createdFiles: string[] = []
    const createdDirs: string[] = []
    try {
      for (const asset of assets) {
        if (!asset.exists) throw new Error(`模板文件已失效：${asset.name}`)
        const source = path.resolve(sourceRoot, asset.path)
        const target = path.resolve(directory, asset.path)
        if (source !== sourceRoot && !source.startsWith(sourceRoot + path.sep)) throw new Error('模板路径无效')
        if (target !== directory && !target.startsWith(directory + path.sep)) throw new Error('模板路径无效')
        if (fs.existsSync(target)) throw new Error(`目标目录已有同名文件：${asset.name}`)
        const parts = path.relative(directory, path.dirname(target)).split(path.sep)
        let current = directory
        for (const part of parts) {
          if (part === '.') continue
          current = path.join(current, part)
          if (!fs.existsSync(current)) { fs.mkdirSync(current); createdDirs.push(current) }
          else if (!fs.statSync(current).isDirectory() || fs.lstatSync(current).isSymbolicLink()) throw new Error('目标目录包含非普通文件夹')
        }
        fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL)
        createdFiles.push(target)
        if (digest(source) !== digest(target)) throw new Error(`模板文件校验失败：${asset.name}`)
      }
      this.write(next)
    } catch (error) {
      for (const file of createdFiles.reverse()) fs.rmSync(file, { force: true })
      for (const folder of createdDirs.reverse()) fs.rmdirSync(folder)
      throw error
    }
    this.service.templateRoot = directory
    this.locations = next
    return { ...this.locations }
  }
  close() { this.service.close() }
}
