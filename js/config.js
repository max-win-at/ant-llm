/**
 * Global configuration for the ant colony simulation.
 */
export const CONFIG = {
  // --- Canvas ---
  CANVAS_WIDTH: 800,
  CANVAS_HEIGHT: 600,

  // --- Colony ---
  INITIAL_COLONY_SIZE: 20,
  MAX_COLONY_SIZE: 200,
  NEST_X: 400,
  NEST_Y: 300,
  NEST_RADIUS: 30,

  // --- Ant ---
  ANT_SPEED: 2,
  ANT_MAX_ENERGY: 100,
  ANT_INITIAL_ENERGY: 80,
  ANT_ENERGY_DECAY_PER_TICK: 0.1,
  ANT_ENERGY_GAIN_ON_FOOD: 30,
  ANT_SIGHT_RADIUS: 60,
  ANT_WANDER_JITTER: 0.3, // radians of random heading change

  // --- Pheromone ---
  PHEROMONE_EVAPORATION_RATE: 0.005, // rho: fraction lost per tick
  PHEROMONE_DEPOSIT_AMOUNT: 1.0,
  PHEROMONE_MAX: 10,
  PHEROMONE_GRID_CELL_SIZE: 10,

  // --- Cookie / Food ---
  COOKIE_MAX_AGE_SECONDS: 3600,
  COOKIE_PREFIX: 'antfood_',

  // --- API Food Sources ---
  FOOD_SOURCES: [
    {
      name: 'JSONPlaceholder Posts',
      url: 'https://jsonplaceholder.typicode.com/posts/',
      type: 'simple',
      nutritionMultiplier: 1.0,
    },
    {
      name: 'JSONPlaceholder Todos',
      url: 'https://jsonplaceholder.typicode.com/todos/',
      type: 'simple',
      nutritionMultiplier: 0.8,
    },
    {
      name: 'PokeAPI',
      url: 'https://pokeapi.co/api/v2/pokemon/',
      type: 'complex',
      nutritionMultiplier: 2.0,
    },
    {
      name: 'REST Countries',
      url: 'https://restcountries.com/v3.1/all',
      type: 'complex',
      nutritionMultiplier: 1.5,
    },
  ],

  // --- Danger Sources ---
  DANGER_SOURCES: [
    {
      name: 'Rate Limiter (429)',
      url: 'https://httpstat.us/429',
      type: 'predator',
      damage: 50,
    },
    {
      name: 'Server Error (500)',
      url: 'https://httpstat.us/500',
      type: 'storm',
      damage: 30,
    },
    {
      name: 'Slow Response',
      url: 'https://httpstat.us/200?sleep=5000',
      type: 'swamp',
      damage: 10,
    },
  ],

  // --- Simulation ---
  TICK_INTERVAL_MS: 50, // 20 FPS simulation
  RENDER_INTERVAL_MS: 50, // 20 FPS rendering
  FORAGE_COOLDOWN_TICKS: 100, // ticks between API calls per ant
  REPRODUCTION_FOOD_THRESHOLD: 5, // cookies needed to spawn a new ant

  // --- LocalStorage Keys ---
  LS_KEY_ANTS: 'colony_ants',
  LS_KEY_STATS: 'colony_stats',
};
