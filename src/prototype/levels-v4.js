// V4 levels author only sparse obstacles. v3 fixtures remain in levels.js.
import { validateV4Level } from './model-v4.js';
const layouts=[
 [[1,1]],
 [[3,2]],
 [[2,2],[4,4]],
 [[4,2],[2,4]],
 [[3,1],[3,4]],
 [[1,3],[4,3],[3,5]],
 [[2,1],[4,3],[2,5]],
 [[3,2],[2,4],[5,4]],
 [[1,2],[3,3],[5,5]],
 [[2,2],[4,2],[2,4],[4,4]],
 [[1,3],[3,1],[3,4],[5,3]],
 [[2,1],[4,2],[2,4],[4,5]],
];
export const v4Levels=layouts.map((points,index)=>validateV4Level({
 id:'magnet-v4-'+String(index+1).padStart(2,'0'),number:index+1,
 blockers:points.map(([col,row])=>({col,row})),
}));

