const steps = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
export function distances(tiles, origin) {
  const found = new Map([[`${origin.x},${origin.y}`, 0]]),
    queue = [origin];
  for (const p of queue)
    for (const [dx, dy] of steps) {
      const x = p.x + dx,
        y = p.y + dy,
        key = `${x},${y}`;
      if (tiles[y]?.[x] === 0 && !found.has(key)) {
        found.set(key, found.get(`${p.x},${p.y}`) + 1);
        queue.push({ x, y });
      }
    }
  return found;
}
export function generateDistrict(floor, random) {
  const tiles = Array.from({ length: 11 }, (_, y) =>
    Array.from({ length: 11 }, (_, x) =>
      x === 0 || y === 0 || x === 10 || y === 10 ? 1 : 0,
    ),
  );
  // A one-entry alcove forces a real return journey: it cannot lie on a shortest exit route.
  const east = random() < 0.5;
  const landmark = east
    ? { x: 8, y: 2, resolved: false }
    : { x: 2, y: 8, resolved: false };
  const pocketWalls = east
    ? [
        [7, 2],
        [9, 2],
        [8, 3],
      ]
    : [
        [2, 7],
        [3, 8],
        [2, 9],
      ];
  for (const [x, y] of pocketWalls) tiles[y][x] = 1;
  function wall(x, y) {
    if (
      tiles[y]?.[x] !== 0 ||
      (x <= 2 && y <= 2) ||
      (x === 9 && y === 9) ||
      (x === landmark.x && y === landmark.y)
    )
      return;
    tiles[y][x] = 1;
    if (
      distances(tiles, { x: 1, y: 1 }).size !==
      tiles.flat().filter((t) => t === 0).length
    )
      tiles[y][x] = 0;
  }
  // Cut before the alcove's approach junction, so the cut cannot isolate it.
  wall(4 + Math.floor(random() * 2), 1);
  wall(1, 4 + Math.floor(random() * 2));
  if (floor === 0) {
    // Piers with cross-passages along the waterfront.
    for (const x of [3, 6]) {
      const gap = 3 + Math.floor(random() * 5);
      for (let y = 3; y <= 8; y++) if (y !== gap) wall(x, y);
    }
  } else if (floor === 1) {
    // Alternating market lanes around Dragon Gate.
    for (const y of [3, 5, 7]) {
      const gap = 2 + Math.floor(random() * 6);
      for (let x = 2; x <= 8; x++) if (x !== gap && x !== gap + 1) wall(x, y);
    }
  } else if (floor === 2) {
    // Two tram platforms, crossed at offset stops.
    for (const y of [4, 7]) {
      const gap = 2 + Math.floor(random() * 6);
      for (let x = 1; x <= 9; x++) if (x !== gap && x !== gap + 1) wall(x, y);
    }
  } else {
    // Exhibition booths create alternating open aisles.
    for (const x of [3, 6])
      for (const y of [3, 6])
        for (const [dx, dy] of [
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 1],
        ])
          if (random() > 0.15) wall(x + dx, y + dy);
  }
  for (let i = 0; i < 12; i++)
    wall(1 + Math.floor(random() * 9), 1 + Math.floor(random() * 9));
  return { tiles, landmark };
}
