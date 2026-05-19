const fs = require('fs');
['JobList.tsx', 'PostList.tsx'].forEach(f => {
  const p = 'src/components/' + f;
  let c = fs.readFileSync(p, 'utf8');
  c = c.replace(/\\n/g, '\n').replace(/\\"/g, '"');
  fs.writeFileSync(p, c);
});
