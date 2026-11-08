import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { StorageChangeResult } from '../shared/model'
import { inside, isSameOrInside, libraryDatabaseFile, WorkPackService } from './service'

export type StorageKind = 'project' | 'template' | 'workspace'
export interface StorageLocations { project: string; template: string; workspace: string }
const locationsSchema = z.object({ project: z.string(), template: z.string(), workspace: z.string() })
const keptDatabaseMessage = '目标目录仍保留着 workpack-v3.sqlite。更换工作空间时原数据库不会删除，迁回前请先把 workpack-v3.sqlite 以及旁边的 -wal、-shm 文件移走或删除。'
const unixSystemRoots = new Set(['bin', 'sbin', 'usr', 'lib', 'lib64', 'etc', 'var', 'dev', 'proc', 'sys', 'boot', 'run', 'lost+found', 'root', 'System', 'Library', 'private', 'Applications', 'cores'])
const windowsSystemRoots = new Set(['windows', 'program files', 'program files (x86)', 'programdata', '$recycle.bin', 'system volume information'])

function selectedDirectory(value: string) {
  if (!path.isAbsolute(value) || !fs.existsSync(value) || !fs.statSync(value).isDirectory()) throw new Error('请选择已存在的目录')
  return fs.realpathSync(value)
}
function isDirectory(value: string) { try { return fs.statSync(value).isDirectory() } catch { return false } }
function isFile(value: string) { try { return fs.statSync(value).isFile() } catch { return false } }
const templateManifestSchema = z.object({ source: z.string(), publication: z.literal('link').optional(), files: z.array(z.object({ path: z.string(), sha256: z.string(), staging: z.string().optional() })) })
type TemplateManifest = z.infer<typeof templateManifestSchema>
/** Streams in fixed-size chunks so memory stays bounded and the main process keeps handling events however large a template is. */
export async function fileDigest(file: string) {
  const hash = createHash('sha256')
  for await (const chunk of fs.createReadStream(file, { highWaterMark: 1 << 20 })) hash.update(chunk as Buffer)
  return hash.digest('hex')
}
function createdDirectory(directory: string) {
  try { fs.mkdirSync(directory, { recursive: true }); return isDirectory(directory) } catch { return false }
}
function isDriveRoot(directory: string) {
  if (path.parse(directory).root === directory) return true
  try {
    const parent = path.dirname(directory)
    if (parent === directory) return true
    return fs.statSync(directory).dev !== fs.statSync(parent).dev
  } catch { return false }
}
function isSystemPath(directory: string) {
  const top = path.relative(path.parse(directory).root, directory).split(path.sep)[0]
  if (!top) return false
  if (process.platform === 'win32') return windowsSystemRoots.has(top.toLowerCase())
  return unixSystemRoots.has(top)
}
function sameRealPath(directory: string, candidate: string) {
  try { return fs.realpathSync(candidate) === directory } catch { return false }
}
function syncFolderLabel(name: string): string | null {
  const value = name.normalize('NFC')
  if (/^onedrive($|[\s-])/i.test(value)) return 'OneDrive'
  if (/^dropbox($|[\s(-])/i.test(value)) return 'Dropbox'
  if (/^icloud ?drive$/i.test(value)) return 'iCloud'
  if (/^google drive$/i.test(value) || value === 'Google 云端硬盘') return 'Google Drive'
  if (/^pcloud drive$/i.test(value)) return 'pCloud'
  if (/^nutstore$/i.test(value) || value === '坚果云') return '坚果云'
  if (/^mega$/i.test(value)) return 'MEGA'
  if (/^creative cloud files$/i.test(value)) return 'Creative Cloud'
  if (/^box sync$/i.test(value)) return 'Box'
  return null
}
function syncLabel(directory: string): string | null {
  for (const part of directory.split(path.sep)) {
    const label = syncFolderLabel(part)
    if (label) return label
  }
  if (directory.includes(`${path.sep}Library${path.sep}CloudStorage${path.sep}`)) return '云盘'
  if (directory.includes(`${path.sep}Library${path.sep}Mobile Documents${path.sep}`)) return 'iCloud'
  for (const key of ['OneDrive', 'OneDriveConsumer', 'OneDriveCommercial']) {
    const configured = process.env[key]
    if (configured) try { if (isSameOrInside(directory, fs.realpathSync(configured))) return 'OneDrive' } catch { /* The configured folder is not on this machine. */ }
  }
  return null
}
function isNetworkPath(directory: string) { return directory.startsWith('\\\\') || directory.startsWith('//') }
/** Drive roots and system folders are rejected. Sync folders reject the live database and warn for ordinary files. */
function rejectUnsuitable(kind: StorageKind, directory: string): string | undefined {
  if (isDriveRoot(directory)) throw new Error('不能选择磁盘根目录，请指定一个专用文件夹')
  if (isSystemPath(directory)) throw new Error('不能选择系统目录，请指定一个普通的数据文件夹')
  if (sameRealPath(directory, os.homedir())) throw new Error('不能直接使用用户主目录，请在其中新建一个专用文件夹')
  if (sameRealPath(directory, os.tmpdir())) throw new Error('不能直接使用系统临时目录，请选择会长期保留的文件夹')
  try { fs.accessSync(directory, fs.constants.W_OK) } catch { throw new Error('所选目录没有写入权限') }
  const sync = syncLabel(directory)
  const network = isNetworkPath(directory)
  if (kind === 'workspace' && (sync || network)) {
    const where = sync ? `${sync} 同步文件夹` : '网络位置'
    throw new Error(`工作空间数据库不能放在${where}中，同步或网络中断可能损坏数据库。请选择本机未同步的文件夹。`)
  }
  if (sync) return `所选文件夹在 ${sync} 同步目录中。项目和模板文件可以放在这里，但不要同时在多台电脑上修改同一份文件。`
  if (network) return '所选文件夹在网络位置上。文件可以放在这里，但网络中断时可能无法访问。'
  return undefined
}

/** A configured workspace whose database is gone. Launch must not replace it with an empty one. */
export class WorkspaceMissingError extends Error {
  constructor(readonly workspace: string) { super(`找不到工作空间数据库：${path.join(workspace, libraryDatabaseFile)}`) }
}
/**
 * `locate` points the configuration at a folder that already holds the database.
 * `create` starts an empty database in the configured folder at the user's request.
 */
export type WorkspaceRecovery = { locate: string } | { create: true }

/** The pointer remains in userData; the database and template files can live elsewhere. */
export class StorageManager {
  readonly configPath: string
  readonly defaults: StorageLocations
  locations: StorageLocations
  service: WorkPackService
  private changing = false
  constructor(systemDirectory: string, defaultProjectDirectory: string, recovery?: WorkspaceRecovery) {
    fs.mkdirSync(systemDirectory, { recursive: true })
    this.configPath = path.join(systemDirectory, 'storage.json')
    // Without a pointer file, this marker tells a missing default database apart from a first launch.
    const initializedPath = path.join(systemDirectory, 'workspace.initialized')
    this.defaults = { project: defaultProjectDirectory, template: path.join(systemDirectory, 'templates'), workspace: systemDirectory }
    const configured = fs.existsSync(this.configPath), initialized = fs.existsSync(initializedPath)
    const stored = configured ? locationsSchema.parse(JSON.parse(fs.readFileSync(this.configPath, 'utf8'))) : { ...this.defaults }
    if (recovery && 'locate' in recovery) stored.workspace = recovery.locate
    const mustExist = (configured || initialized) && !(recovery && 'create' in recovery)
    this.locations = this.canonicalize(stored, mustExist)
    this.clearCommittedMarker(this.locations.workspace)
    // An older offline relocation may point at an unfinished move; only clean proven published aliases.
    this.clearCommittedTemplateManifest(this.locations.template)
    this.service = this.open(this.locations, mustExist)
    if (!initialized) try { fs.writeFileSync(initializedPath, '') } catch { /* Launch goes on; the next one writes the marker again. */ }
    if (recovery && 'locate' in recovery) {
      try { this.write(this.locations) }
      catch (error) { this.service.close(); throw error }
    }
  }
  private canonicalize(locations: StorageLocations, workspaceMustExist: boolean): StorageLocations {
    const next = { ...locations }
    for (const key of ['project', 'template', 'workspace'] as const) {
      if (!path.isAbsolute(next[key])) throw new Error('存储配置中的路径必须是绝对路径')
      if (key === 'workspace' && workspaceMustExist) {
        if (!fs.existsSync(this.databasePath(next[key]))) throw new WorkspaceMissingError(next[key])
      } else if (key !== 'workspace') {
        // An offline drive or share stays configured and is reported as unavailable. Only a default folder is created.
        if (!isDirectory(next[key]) && (path.resolve(next[key]) !== path.resolve(this.defaults[key]) || !createdDirectory(next[key]))) {
          next[key] = path.resolve(next[key])
          continue
        }
      } else fs.mkdirSync(next[key], { recursive: true })
      next[key] = fs.realpathSync(next[key])
      if (!fs.statSync(next[key]).isDirectory()) throw new Error('存储位置必须是文件夹')
    }
    return next
  }
  private open(locations: StorageLocations, databaseMustExist = false) {
    return new WorkPackService(locations.workspace, undefined, { templateRoot: locations.template, projectRoot: locations.project, databaseMustExist })
  }
  private write(locations: StorageLocations) {
    const temp = `${this.configPath}.${randomUUID()}.tmp`
    fs.writeFileSync(temp, JSON.stringify(locations, null, 2), { flag: 'wx' })
    try { fs.renameSync(temp, this.configPath) }
    catch (error) { fs.rmSync(temp, { force: true }); throw error }
  }
  private result(warning?: string): StorageChangeResult {
    const locations = { ...this.locations }, unavailable = this.unavailable()
    return warning ? { locations, unavailable, warning } : { locations, unavailable }
  }
  private databasePath(workspace: string) { return path.join(workspace, libraryDatabaseFile) }
  private markerPath(destination: string) { return path.join(path.dirname(destination), `.${path.basename(destination)}.migrating`) }
  private readMarker(destination: string): { source: string } | null {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.markerPath(destination), 'utf8')) as { source?: unknown }
      if (!parsed || typeof parsed.source !== 'string' || !path.isAbsolute(parsed.source)) return null
      return { source: parsed.source }
    } catch { return null }
  }
  private writeMarker(destination: string) {
    const marker = this.markerPath(destination)
    const temp = `${marker}.${randomUUID()}.tmp`
    fs.writeFileSync(temp, JSON.stringify({ source: this.locations.workspace }), { flag: 'wx' })
    try { fs.renameSync(temp, marker) }
    catch (error) { fs.rmSync(temp, { force: true }); throw error }
  }
  /** A marker left in the directory config already points at was committed; drop the marker only. */
  private clearCommittedMarker(workspace: string) {
    const destination = this.databasePath(workspace)
    if (!this.readMarker(destination)) return
    try { fs.rmSync(this.markerPath(destination), { force: true }) } catch { /* A leftover marker must not block launch. */ }
  }
  private workspaceFilesPresent(destination: string) {
    return [destination, `${destination}-wal`, `${destination}-shm`].some(file => fs.existsSync(file))
  }
  private removeIncompleteDatabase(destination: string) {
    const live = path.resolve(this.service.db.name)
    if ([destination, `${destination}-wal`, `${destination}-shm`].some(file => path.resolve(file) === live)) throw new Error('不能清理正在使用的数据库')
    for (const file of [destination, `${destination}-wal`, `${destination}-shm`]) fs.rmSync(file, { force: true })
    const dir = path.dirname(destination)
    const prefix = `.${path.basename(destination)}.`
    if (!fs.existsSync(dir)) return
    for (const entry of fs.readdirSync(dir)) {
      if (entry.startsWith(prefix) && entry.endsWith('.tmp')) fs.rmSync(path.join(dir, entry), { force: true })
    }
  }
  /** An unfinished copy keeps its marker. A database without that marker is the one we intentionally left behind. */
  private prepareWorkspaceDestination(destination: string) {
    const marker = this.readMarker(destination)
    const ours = marker?.source === this.locations.workspace
    if (this.workspaceFilesPresent(destination)) {
      if (!ours) throw new Error(keptDatabaseMessage)
      this.removeIncompleteDatabase(destination)
    }
    if (ours) fs.rmSync(this.markerPath(destination), { force: true })
    this.writeMarker(destination)
  }
  private abandonWorkspaceCopy(reopened: WorkPackService | undefined, destination: string) {
    if (reopened) try { reopened.close() } catch { /* The unfinished copy is still removed below. */ }
    try { this.removeIncompleteDatabase(destination) }
    catch { return /* Keep the marker so the next attempt can remove this residue. */ }
    try { fs.rmSync(this.markerPath(destination), { force: true }) } catch { /* Keep the marker so the next attempt can remove this residue. */ }
  }
  private restoreClosedService(previous: WorkPackService) {
    if (previous.db.open) { this.service = previous; return }
    this.service = this.open(this.locations)
  }
  /**
   * Close the old connection before the pointer moves. A crash after the copy and before
   * the pointer is written leaves a marker, so the next attempt can replace that residue.
   */
  private changeWorkspace(directory: string, next: StorageLocations, warning?: string): StorageChangeResult {
    const destination = this.databasePath(directory)
    this.prepareWorkspaceDestination(destination)
    const previous = this.service
    let reopened: WorkPackService | undefined
    try {
      previous.backupDatabase(destination)
      reopened = this.open(next)
      reopened.snapshot()
      previous.close()
    } catch (error) {
      this.abandonWorkspaceCopy(reopened, destination)
      try { this.restoreClosedService(previous) } catch { /* Config still names the original database. */ }
      throw error
    }
    try { this.write(next) }
    catch (error) {
      this.abandonWorkspaceCopy(reopened, destination)
      try { this.restoreClosedService(previous) } catch { /* Config still names the original database. */ }
      throw error
    }
    this.service = reopened
    this.locations = next
    try { fs.rmSync(this.markerPath(destination), { force: true }) } catch { /* The next launch removes a marker in the committed directory. */ }
    return this.result(warning)
  }
  /** Lists the copies a template move is about to create, so an interrupted move can recognise its own files. */
  private templateManifestPath(directory: string) { return path.join(directory, '.workpack-templates.migrating') }
  private writeTemplateManifest(directory: string, manifest: TemplateManifest) {
    const target = this.templateManifestPath(directory), temp = `${target}.${randomUUID()}.tmp`
    fs.writeFileSync(temp, JSON.stringify(manifest), { flag: 'wx' })
    try { fs.renameSync(temp, target) }
    catch (error) { fs.rmSync(temp, { force: true }); throw error }
  }
  private readTemplateManifest(directory: string): TemplateManifest | null {
    try {
      const parsed = templateManifestSchema.safeParse(JSON.parse(fs.readFileSync(this.templateManifestPath(directory), 'utf8')))
      return parsed.success ? parsed.data : null
    } catch { return null }
  }
  private clearCommittedTemplateManifest(directory: string) {
    try {
      const manifest = this.readTemplateManifest(directory)
      let unfinished = false
      if (manifest?.publication === 'link') for (const file of manifest.files) {
        if (!file.staging) continue
        const staging = inside(directory, file.staging, '模板')
        if (!fs.existsSync(staging)) continue
        const target = inside(directory, file.path, '模板')
        if (!isFile(staging) || !isFile(target) || !this.sameFile(staging, target)) { unfinished = true; continue }
        fs.rmSync(staging, { force: true })
      }
      if (!unfinished) fs.rmSync(this.templateManifestPath(directory), { force: true })
    } catch { /* Keep the manifest so the next launch can finish cleaning its staging files. */ }
  }
  private sameFile(left: string, right: string) {
    try {
      const a = fs.statSync(left, { bigint: true }), b = fs.statSync(right, { bigint: true })
      return a.dev === b.dev && a.ino === b.ino
    } catch { return false }
  }
  /**
   * Removes copies left by an interrupted move from the same source. A staging file has a name no one else uses and is
   * always ours; a file at its final name is ours only when it matches the recorded copy.
   */
  private async clearTemplateResidue(directory: string, sourceRoot: string) {
    const manifest = this.readTemplateManifest(directory)
    if (manifest?.source !== sourceRoot) return
    for (const file of manifest.files) {
      let target: string, staging: string | undefined
      try {
        target = inside(directory, file.path, '模板')
        if (file.staging) staging = inside(directory, file.staging, '模板')
      } catch { continue }
      const owned = manifest.publication === 'link'
        ? Boolean(staging && this.sameFile(staging, target)) && await fileDigest(target) === file.sha256
        : isFile(target) && await fileDigest(target) === file.sha256
      if (owned) fs.rmSync(target)
      if (staging && isFile(staging)) fs.rmSync(staging)
      for (let dir = path.dirname(target); dir !== directory && isSameOrInside(dir, directory) && isDirectory(dir) && !fs.readdirSync(dir).length; dir = path.dirname(dir)) fs.rmdirSync(dir)
    }
    fs.rmSync(this.templateManifestPath(directory), { force: true })
  }
  /** Project and template folders that cannot be reached right now, such as a disconnected drive. */
  unavailable(): StorageKind[] { return (['project', 'template'] as const).filter(kind => !isDirectory(this.locations[kind])) }
  private async changeTemplates(directory: string, next: StorageLocations, warning?: string): Promise<StorageChangeResult> {
    const sourceRoot = this.locations.template
    if (!isDirectory(sourceRoot)) {
      // Do not reclassify an unfinished move as committed when its source cannot be read.
      if (fs.existsSync(this.templateManifestPath(directory))) throw new Error('所选目录包含未完成的模板迁移，请先恢复原模板存储位置后重试')
      // Nothing can be copied from an unreachable folder; point at the folder the user chose instead.
      this.write(next)
      this.service.templateRoot = directory
      this.locations = next
      return this.result(warning)
    }
    const plan: Array<{ asset: { name: string; path: string }; source: string; target: string; staging: string; sha256: string }> = []
    for (const asset of this.service.snapshot().templates.flatMap(template => template.assets)) {
      const source = inside(sourceRoot, asset.path, '模板')
      if (!asset.exists) throw new Error(`模板文件已失效：${asset.name}`)
      const target = inside(directory, asset.path, '模板')
      const staging = inside(directory, path.join(path.dirname(asset.path), `.workpack-${randomUUID()}.tmp`), '模板')
      plan.push({ asset, source, target, staging, sha256: await fileDigest(source) })
    }
    await this.clearTemplateResidue(directory, sourceRoot)
    // The manifest must never list a file that was there before the move, or a retry would delete it as residue.
    const taken = plan.find(file => fs.existsSync(file.target))
    if (taken) throw new Error(`目标目录已有同名文件：${taken.asset.name}`)
    this.writeTemplateManifest(directory, { source: sourceRoot, publication: 'link', files: plan.map(file => ({ path: file.asset.path, sha256: file.sha256, staging: path.relative(directory, file.staging) })) })
    const createdFiles: string[] = []
    const createdDirs: string[] = []
    try {
      // A copy is written under its staging name and takes its final name only once verified, so a final name never holds a partial file.
      for (const { asset, source, target, staging, sha256 } of plan) {
        if (fs.existsSync(target)) throw new Error(`目标目录已有同名文件：${asset.name}`)
        const parts = path.relative(directory, path.dirname(target)).split(path.sep)
        let current = directory
        for (const part of parts) {
          if (part === '.') continue
          current = path.join(current, part)
          if (!fs.existsSync(current)) { fs.mkdirSync(current); createdDirs.push(current) }
          else if (!fs.statSync(current).isDirectory() || fs.lstatSync(current).isSymbolicLink()) throw new Error('目标目录包含非普通文件夹')
        }
        try { await fs.promises.copyFile(source, staging, fs.constants.COPYFILE_EXCL) }
        catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'EEXIST' && fs.existsSync(staging)) createdFiles.push(staging)
          throw error
        }
        createdFiles.push(staging)
        if (await fileDigest(staging) !== sha256) throw new Error(`模板文件校验失败：${asset.name}`)
        if (fs.existsSync(target)) throw new Error(`目标目录已有同名文件：${asset.name}`)
        // link publishes atomically and fails with EEXIST instead of replacing another writer's file.
        // Keep staging until the pointer commits: its file identity proves which final files we own after a crash.
        await fs.promises.link(staging, target)
        createdFiles.push(target)
      }
      this.write(next)
    } catch (error) {
      for (const file of createdFiles.reverse()) fs.rmSync(file, { force: true })
      for (const folder of createdDirs.reverse()) if (!fs.readdirSync(folder).length) fs.rmdirSync(folder)
      fs.rmSync(this.templateManifestPath(directory), { force: true })
      throw error
    }
    this.service.templateRoot = directory
    this.locations = next
    this.clearCommittedTemplateManifest(directory)
    return this.result(warning)
  }
  async change(kind: StorageKind, selected: string): Promise<StorageChangeResult> {
    if (this.changing) throw new Error('存储位置正在更改，请等待完成后再试')
    this.changing = true
    try { return await this.applyChange(kind, selected) }
    finally { this.changing = false }
  }
  private async applyChange(kind: StorageKind, selected: string): Promise<StorageChangeResult> {
    const directory = selectedDirectory(selected)
    if (directory === this.locations[kind]) return this.result()
    const warning = rejectUnsuitable(kind, directory)
    if (this.service.projectFolders().some(folder => isSameOrInside(directory, folder))) throw new Error('不能选择项目文件夹或其中的目录，删除事项时会一并删除其中的文件')
    const next = { ...this.locations, [kind]: directory }
    if (kind === 'project') {
      this.write(next)
      this.locations = next
      this.service.projectRoot = directory
      return this.result(warning)
    }
    if (kind === 'workspace') return this.changeWorkspace(directory, next, warning)
    const service = this.service
    service.templateMoveInProgress = true
    try { return await this.changeTemplates(directory, next, warning) }
    finally { service.templateMoveInProgress = false }
  }
  close() { this.service.close() }
}
