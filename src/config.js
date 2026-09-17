export const config = {
  arena: {
    width: 1080,
    height: 1920,
    wallThickness: 100,
    wallBounciness: 1.0,
  },
  racers: {
    count: 50,
    size: 60,
    restitution: 1.0,
    friction: 0.0,
    density: 0.002,
  },
  obstacles: {
    pegRows: 8,
    pegSpacing: 120,
    pegSize: 10,
    restitution: 1.0,
  },
  physics: {
    gravity: 0.0,
  }
};
