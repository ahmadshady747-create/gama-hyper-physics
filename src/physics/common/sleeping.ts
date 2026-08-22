export interface ISleepableBody {
  id: number;
  isStatic: boolean;
  isSleeping: boolean;
  canSleep: boolean;
  sleepTimer: number;
  getKineticEnergy(): number;
  wakeUp(): void;
  putToSleep(): void;
}

export interface ISleepContact<T extends ISleepableBody = ISleepableBody> {
  bodyA: T;
  bodyB: T;
}

export interface SleepConfig {
  linearVelocityThresholdSq?: number; // e.g. 16.0 (4 px/s)^2
  angularVelocityThresholdSq?: number; // e.g. 0.0025 (0.05 rad/s)^2
  energyThreshold?: number; // E_kin < epsilon (e.g. 0.5)
  timeToSleep?: number; // seconds required (default: 0.5s)
}

/** Zero-GC Island Sleeping & Wakeup Propagation Engine */
export class IslandSleepingManager<T extends ISleepableBody = ISleepableBody> {
  public energyThreshold: number = 0.8;
  public timeToSleep: number = 0.5;
  public enabled: boolean = true;

  // Pre-allocated island traversal buffers
  private islandStack: T[] = [];
  private visited: Set<number> = new Set();
  private currentIsland: T[] = [];
  private adjacency: Map<number, T[]> = new Map();

  constructor(config?: SleepConfig) {
    if (config?.energyThreshold !== undefined) this.energyThreshold = config.energyThreshold;
    if (config?.timeToSleep !== undefined) this.timeToSleep = config.timeToSleep;
  }

  /** Updates sleep timers and puts qualifying islands to sleep, or wakes touching bodies */
  public update(bodies: T[], contacts: ISleepContact<T>[], dt: number): void {
    if (!this.enabled) return;

    // 1. Wakeup propagation across touching pairs: if one body is awake, the other must wake up
    for (let i = 0; i < contacts.length; i++) {
      const a = contacts[i].bodyA;
      const b = contacts[i].bodyB;
      if (!a.isStatic && !b.isStatic) {
        if (!a.isSleeping && b.isSleeping) {
          b.wakeUp();
        } else if (a.isSleeping && !b.isSleeping) {
          a.wakeUp();
        }
      } else if (a.isStatic && b.isSleeping) {
        // Static vs sleeping: stays asleep unless external force
      } else if (b.isStatic && a.isSleeping) {
        // Static vs sleeping: stays asleep unless external force
      }
    }

    // 2. Build Adjacency Graph for dynamic bodies
    this.adjacency.clear();
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      if (!b.isStatic) {
        this.adjacency.set(b.id, []);
      }
    }

    for (let i = 0; i < contacts.length; i++) {
      const a = contacts[i].bodyA;
      const b = contacts[i].bodyB;
      if (!a.isStatic && !b.isStatic) {
        this.adjacency.get(a.id)?.push(b);
        this.adjacency.get(b.id)?.push(a);
      }
    }

    // 3. Find connected islands and evaluate sleep condition
    this.visited.clear();

    for (let i = 0; i < bodies.length; i++) {
      const seed = bodies[i];
      if (seed.isStatic || this.visited.has(seed.id) || !seed.canSleep) continue;

      // Collect connected island via DFS
      this.currentIsland.length = 0;
      this.islandStack.length = 0;
      this.islandStack.push(seed);
      this.visited.add(seed.id);

      let islandCanSleep = true;

      while (this.islandStack.length > 0) {
        const curr = this.islandStack.pop()!;
        this.currentIsland.push(curr);

        // Check kinetic energy
        const energy = curr.getKineticEnergy();
        if (energy > this.energyThreshold) {
          islandCanSleep = false;
          curr.sleepTimer = 0;
        } else {
          curr.sleepTimer += dt;
          if (curr.sleepTimer < this.timeToSleep) {
            islandCanSleep = false;
          }
        }

        const neighbors = this.adjacency.get(curr.id);
        if (neighbors) {
          for (let n = 0; n < neighbors.length; n++) {
            const neighbor = neighbors[n];
            if (!this.visited.has(neighbor.id)) {
              this.visited.add(neighbor.id);
              this.islandStack.push(neighbor);
            }
          }
        }
      }

      // 4. Apply sleep or maintain active state for entire island
      if (islandCanSleep) {
        for (let j = 0; j < this.currentIsland.length; j++) {
          this.currentIsland[j].putToSleep();
        }
      } else {
        for (let j = 0; j < this.currentIsland.length; j++) {
          if (this.currentIsland[j].isSleeping) {
            this.currentIsland[j].wakeUp();
          }
        }
      }
    }
  }
}
