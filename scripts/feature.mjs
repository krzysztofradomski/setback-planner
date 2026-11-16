import {readFileSync,writeFileSync} from 'node:fs';
const [id,status,note]=process.argv.slice(2),path='docs/features.json',data=JSON.parse(readFileSync(path,'utf8')),feature=data.features.find(f=>f.id===id);
if(!feature||!['completed','in_progress','blocked','queued'].includes(status))throw new Error('Invalid feature');
feature.status=status;if(status==='completed')feature.tests=[...new Set([...feature.tests,'npm test','npm run typecheck','npm run lint','npm run build','npm run test:e2e'])];
if(note)feature.knownLimitations=[note];writeFileSync(path,JSON.stringify(data,null,2)+'\n');
if(note)writeFileSync('docs/implementation-status.md',readFileSync('docs/implementation-status.md','utf8')+`\n${id} ${status}: ${note}\n`);
