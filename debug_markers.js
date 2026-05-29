fetch('http://localhost:3001/api/page-builder/preview/78f24670-c0e3-49d4-9e0b-a59cb887b2c8')
  .then(r => r.json())
  .then(d => {
    const ml = d.data && d.data.mapLayouts && d.data.mapLayouts[0];
    if (!ml || !ml.markers) { console.log('No markers'); return; }
    const all = Object.values(ml.markers).flat();
    all.forEach(m => {
      console.log(JSON.stringify({
        id: m.id,
        kind: m.kind,
        subType: m.subType,
        iconUrl: m.icon && m.icon.url,
        title: m.title,
      }));
    });
  })
  .catch(e => console.error(e));
