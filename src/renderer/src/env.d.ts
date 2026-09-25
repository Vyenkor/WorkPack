/// <reference types="vite/client" />
import type { WorkPackAPI } from '../../shared/model'
declare global { interface Window { workpack: WorkPackAPI } }
