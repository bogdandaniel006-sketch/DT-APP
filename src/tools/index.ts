import type { ToolId } from '../types'
import { createCompassTool } from './compassTool'
import { createParallelTool, createPerpendicularTool } from './constructionTools'
import { createEraserTool } from './eraserTool'
import { createInstrumentTool } from './instrumentTool'
import { createLineTool } from './lineTool'
import { createMeasureTool } from './measureTool'
import { createPointTool } from './pointTool'
import { createSelectTool } from './selectTool'
import type { Tool } from './types'

export const createTools = (): Record<ToolId, Tool> => ({
  select: createSelectTool(),
  point: createPointTool(),
  line: createLineTool(),
  perpendicular: createPerpendicularTool(),
  parallel: createParallelTool(),
  compass: createCompassTool('circle'),
  arc: createCompassTool('arc'),
  escuadra: createInstrumentTool('escuadra'),
  cartabon: createInstrumentTool('cartabon'),
  'measure-distance': createMeasureTool('distance'),
  'measure-angle': createMeasureTool('angle'),
  eraser: createEraserTool(),
})

export const DRAWING_TOOLS: readonly ToolId[] = ['line', 'perpendicular', 'parallel', 'compass', 'arc', 'escuadra', 'cartabon']
