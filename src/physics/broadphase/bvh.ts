import { Vec2, Vec3 } from "../../math";

export class AABB2D {
  public min: Vec2 = new Vec2();
  public max: Vec2 = new Vec2();

  constructor(minX: number = 0, minY: number = 0, maxX: number = 0, maxY: number = 0) {
    this.min.set(minX, minY);
    this.max.set(maxX, maxY);
  }

  public set(minX: number, minY: number, maxX: number, maxY: number): this {
    this.min.set(minX, minY);
    this.max.set(maxX, maxY);
    return this;
  }

  public copy(aabb: AABB2D): this {
    this.min.copy(aabb.min);
    this.max.copy(aabb.max);
    return this;
  }

  public getPerimeter(): number {
    const w = this.max.x - this.min.x;
    const h = this.max.y - this.min.y;
    return 2.0 * (w + h);
  }

  public contains(other: AABB2D): boolean {
    return (
      this.min.x <= other.min.x &&
      this.min.y <= other.min.y &&
      this.max.x >= other.max.x &&
      this.max.y >= other.max.y
    );
  }

  public overlaps(other: AABB2D): boolean {
    if (this.max.x < other.min.x || this.min.x > other.max.x) return false;
    if (this.max.y < other.min.y || this.min.y > other.max.y) return false;
    return true;
  }

  public combine(a: AABB2D, b: AABB2D): this {
    this.min.x = Math.min(a.min.x, b.min.x);
    this.min.y = Math.min(a.min.y, b.min.y);
    this.max.x = Math.max(a.max.x, b.max.x);
    this.max.y = Math.max(a.max.y, b.max.y);
    return this;
  }

  public fatten(margin: number, displacement?: Vec2): this {
    this.min.x -= margin;
    this.min.y -= margin;
    this.max.x += margin;
    this.max.y += margin;

    if (displacement) {
      if (displacement.x < 0) this.min.x += displacement.x * 2.0; else this.max.x += displacement.x * 2.0;
      if (displacement.y < 0) this.min.y += displacement.y * 2.0; else this.max.y += displacement.y * 2.0;
    }
    return this;
  }

  public raycast(origin: Vec2, direction: Vec2, maxFraction: number): { hit: boolean; fraction: number } {
    let tmin = 0;
    let tmax = maxFraction;

    if (Math.abs(direction.x) < 1e-8) {
      if (origin.x < this.min.x || origin.x > this.max.x) return { hit: false, fraction: maxFraction };
    } else {
      const invD = 1.0 / direction.x;
      let t1 = (this.min.x - origin.x) * invD;
      let t2 = (this.max.x - origin.x) * invD;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return { hit: false, fraction: maxFraction };
    }

    if (Math.abs(direction.y) < 1e-8) {
      if (origin.y < this.min.y || origin.y > this.max.y) return { hit: false, fraction: maxFraction };
    } else {
      const invD = 1.0 / direction.y;
      let t1 = (this.min.y - origin.y) * invD;
      let t2 = (this.max.y - origin.y) * invD;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return { hit: false, fraction: maxFraction };
    }

    return { hit: true, fraction: tmin };
  }
}

export class AABB3D {
  public min: Vec3 = new Vec3();
  public max: Vec3 = new Vec3();

  constructor(minX: number = 0, minY: number = 0, minZ: number = 0, maxX: number = 0, maxY: number = 0, maxZ: number = 0) {
    this.min.set(minX, minY, minZ);
    this.max.set(maxX, maxY, maxZ);
  }

  public set(minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number): this {
    this.min.set(minX, minY, minZ);
    this.max.set(maxX, maxY, maxZ);
    return this;
  }

  public copy(aabb: AABB3D): this {
    this.min.copy(aabb.min);
    this.max.copy(aabb.max);
    return this;
  }

  public getSurfaceArea(): number {
    const w = this.max.x - this.min.x;
    const h = this.max.y - this.min.y;
    const d = this.max.z - this.min.z;
    return 2.0 * (w * h + w * d + h * d);
  }

  public contains(other: AABB3D): boolean {
    return (
      this.min.x <= other.min.x &&
      this.min.y <= other.min.y &&
      this.min.z <= other.min.z &&
      this.max.x >= other.max.x &&
      this.max.y >= other.max.y &&
      this.max.z >= other.max.z
    );
  }

  public overlaps(other: AABB3D): boolean {
    if (this.max.x < other.min.x || this.min.x > other.max.x) return false;
    if (this.max.y < other.min.y || this.min.y > other.max.y) return false;
    if (this.max.z < other.min.z || this.min.z > other.max.z) return false;
    return true;
  }

  public combine(a: AABB3D, b: AABB3D): this {
    this.min.x = Math.min(a.min.x, b.min.x);
    this.min.y = Math.min(a.min.y, b.min.y);
    this.min.z = Math.min(a.min.z, b.min.z);
    this.max.x = Math.max(a.max.x, b.max.x);
    this.max.y = Math.max(a.max.y, b.max.y);
    this.max.z = Math.max(a.max.z, b.max.z);
    return this;
  }

  public fatten(margin: number, displacement?: Vec3): this {
    this.min.x -= margin;
    this.min.y -= margin;
    this.min.z -= margin;
    this.max.x += margin;
    this.max.y += margin;
    this.max.z += margin;

    if (displacement) {
      if (displacement.x < 0) this.min.x += displacement.x * 2.0; else this.max.x += displacement.x * 2.0;
      if (displacement.y < 0) this.min.y += displacement.y * 2.0; else this.max.y += displacement.y * 2.0;
      if (displacement.z < 0) this.min.z += displacement.z * 2.0; else this.max.z += displacement.z * 2.0;
    }
    return this;
  }

  public raycast(origin: Vec3, direction: Vec3, maxFraction: number): { hit: boolean; fraction: number } {
    let tmin = 0;
    let tmax = maxFraction;

    if (Math.abs(direction.x) < 1e-8) {
      if (origin.x < this.min.x || origin.x > this.max.x) return { hit: false, fraction: maxFraction };
    } else {
      const invD = 1.0 / direction.x;
      let t1 = (this.min.x - origin.x) * invD;
      let t2 = (this.max.x - origin.x) * invD;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return { hit: false, fraction: maxFraction };
    }

    if (Math.abs(direction.y) < 1e-8) {
      if (origin.y < this.min.y || origin.y > this.max.y) return { hit: false, fraction: maxFraction };
    } else {
      const invD = 1.0 / direction.y;
      let t1 = (this.min.y - origin.y) * invD;
      let t2 = (this.max.y - origin.y) * invD;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return { hit: false, fraction: maxFraction };
    }

    if (Math.abs(direction.z) < 1e-8) {
      if (origin.z < this.min.z || origin.z > this.max.z) return { hit: false, fraction: maxFraction };
    } else {
      const invD = 1.0 / direction.z;
      let t1 = (this.min.z - origin.z) * invD;
      let t2 = (this.max.z - origin.z) * invD;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return { hit: false, fraction: maxFraction };
    }

    return { hit: true, fraction: tmin };
  }
}

export class BVHNode2D<T> {
  public id: number = -1;
  public aabb: AABB2D = new AABB2D();
  public userData: T | null = null;
  public parent: number = -1;
  public left: number = -1;
  public right: number = -1;
  public height: number = 0;
  public moved: boolean = false;

  public isLeaf(): boolean {
    return this.left === -1 && this.right === -1;
  }
}

export class BVHNode3D<T> {
  public id: number = -1;
  public aabb: AABB3D = new AABB3D();
  public userData: T | null = null;
  public parent: number = -1;
  public left: number = -1;
  public right: number = -1;
  public height: number = 0;
  public moved: boolean = false;

  public isLeaf(): boolean {
    return this.left === -1 && this.right === -1;
  }
}

export class DynamicBVHTree2D<T> {
  public nodes: BVHNode2D<T>[] = [];
  public root: number = -1;
  public freeList: number[] = [];
  public nodeCount: number = 0;
  public fatMargin: number = 4.0;

  private queryStack: number[] = new Array(256).fill(0);
  private pairStackA: number[] = new Array(512).fill(0);
  private pairStackB: number[] = new Array(512).fill(0);

  constructor(initialCapacity: number = 256) {
    this.allocatePool(initialCapacity);
  }

  private allocatePool(count: number): void {
    const startIdx = this.nodes.length;
    for (let i = 0; i < count; i++) {
      const node = new BVHNode2D<T>();
      node.id = startIdx + i;
      node.parent = -1;
      this.nodes.push(node);
      this.freeList.push(node.id);
    }
  }

  private allocateNode(): number {
    if (this.freeList.length === 0) {
      this.allocatePool(Math.max(64, this.nodes.length));
    }
    const id = this.freeList.pop() ?? 0;
    const node = this.nodes[id];
    node.parent = -1;
    node.left = -1;
    node.right = -1;
    node.height = 0;
    node.userData = null;
    node.moved = false;
    this.nodeCount++;
    return id;
  }

  private freeNode(id: number): void {
    const node = this.nodes[id];
    node.userData = null;
    node.parent = -1;
    node.left = -1;
    node.right = -1;
    node.height = -1;
    this.freeList.push(id);
    this.nodeCount--;
  }

  public createProxy(aabb: AABB2D, userData: T): number {
    const proxyId = this.allocateNode();
    const node = this.nodes[proxyId];
    node.aabb.copy(aabb).fatten(this.fatMargin);
    node.userData = userData;
    node.height = 0;
    node.moved = true;
    this.insertLeaf(proxyId);
    return proxyId;
  }

  public destroyProxy(proxyId: number): void {
    this.removeLeaf(proxyId);
    this.freeNode(proxyId);
  }

  public moveProxy(proxyId: number, aabb: AABB2D, displacement?: Vec2): boolean {
    const node = this.nodes[proxyId];
    if (node.aabb.contains(aabb)) return false;

    this.removeLeaf(proxyId);
    node.aabb.copy(aabb).fatten(this.fatMargin, displacement);
    this.insertLeaf(proxyId);
    node.moved = true;
    return true;
  }

  public getUserData(proxyId: number): T | null {
    return this.nodes[proxyId]?.userData ?? null;
  }

  public getFatAABB(proxyId: number): AABB2D {
    return this.nodes[proxyId].aabb;
  }

  private insertLeaf(leaf: number): void {
    if (this.root === -1) {
      this.root = leaf;
      this.nodes[this.root].parent = -1;
      return;
    }

    const leafAABB = this.nodes[leaf].aabb;
    let sibling = this.root;
    const combined = new AABB2D();

    while (!this.nodes[sibling].isLeaf()) {
      const left = this.nodes[sibling].left;
      const right = this.nodes[sibling].right;

      const area = this.nodes[sibling].aabb.getPerimeter();
      combined.combine(this.nodes[sibling].aabb, leafAABB);
      const combinedArea = combined.getPerimeter();

      const cost = 2.0 * combinedArea;
      const inheritanceCost = 2.0 * (combinedArea - area);

      let costL: number;
      combined.combine(leafAABB, this.nodes[left].aabb);
      if (this.nodes[left].isLeaf()) {
        costL = combined.getPerimeter() + inheritanceCost;
      } else {
        const oldArea = this.nodes[left].aabb.getPerimeter();
        costL = combined.getPerimeter() - oldArea + inheritanceCost;
      }

      let costR: number;
      combined.combine(leafAABB, this.nodes[right].aabb);
      if (this.nodes[right].isLeaf()) {
        costR = combined.getPerimeter() + inheritanceCost;
      } else {
        const oldArea = this.nodes[right].aabb.getPerimeter();
        costR = combined.getPerimeter() - oldArea + inheritanceCost;
      }

      if (cost < costL && cost < costR) break;
      sibling = costL < costR ? left : right;
    }

    const oldParent = this.nodes[sibling].parent;
    const newParent = this.allocateNode();
    const pNode = this.nodes[newParent];

    pNode.parent = oldParent;
    pNode.aabb.combine(leafAABB, this.nodes[sibling].aabb);
    pNode.height = this.nodes[sibling].height + 1;

    if (oldParent !== -1) {
      if (this.nodes[oldParent].left === sibling) this.nodes[oldParent].left = newParent;
      else this.nodes[oldParent].right = newParent;
    } else {
      this.root = newParent;
    }

    pNode.left = sibling;
    pNode.right = leaf;
    this.nodes[sibling].parent = newParent;
    this.nodes[leaf].parent = newParent;

    let walk: number = this.nodes[leaf].parent;
    while (walk !== -1) {
      walk = this.balance(walk);
      const l = this.nodes[walk].left;
      const r = this.nodes[walk].right;
      this.nodes[walk].height = 1 + Math.max(this.nodes[l].height, this.nodes[r].height);
      this.nodes[walk].aabb.combine(this.nodes[l].aabb, this.nodes[r].aabb);
      walk = this.nodes[walk].parent;
    }
  }

  private removeLeaf(leaf: number): void {
    if (leaf === this.root) {
      this.root = -1;
      return;
    }

    const parent = this.nodes[leaf].parent;
    const grandParent = this.nodes[parent].parent;
    const sibling = this.nodes[parent].left === leaf ? this.nodes[parent].right : this.nodes[parent].left;

    if (grandParent !== -1) {
      if (this.nodes[grandParent].left === parent) this.nodes[grandParent].left = sibling;
      else this.nodes[grandParent].right = sibling;

      this.nodes[sibling].parent = grandParent;
      this.freeNode(parent);

      let walk: number = grandParent;
      while (walk !== -1) {
        walk = this.balance(walk);
        const l = this.nodes[walk].left;
        const r = this.nodes[walk].right;
        this.nodes[walk].aabb.combine(this.nodes[l].aabb, this.nodes[r].aabb);
        this.nodes[walk].height = 1 + Math.max(this.nodes[l].height, this.nodes[r].height);
        walk = this.nodes[walk].parent;
      }
    } else {
      this.root = sibling;
      this.nodes[sibling].parent = -1;
      this.freeNode(parent);
    }
  }

  private balance(iA: number): number {
    const A = this.nodes[iA];
    if (A.isLeaf() || A.height < 2) return iA;

    const iB = A.left, iC = A.right;
    const B = this.nodes[iB], C = this.nodes[iC];
    const balance = C.height - B.height;

    if (balance > 1) {
      const iF = C.left, iG = C.right;
      const F = this.nodes[iF], G = this.nodes[iG];

      C.left = iA; C.parent = A.parent; A.parent = iC;
      if (C.parent !== -1) {
        if (this.nodes[C.parent].left === iA) this.nodes[C.parent].left = iC;
        else this.nodes[C.parent].right = iC;
      } else {
        this.root = iC;
      }

      if (F.height > G.height) {
        C.right = iF; A.right = iG; G.parent = iA;
        A.aabb.combine(B.aabb, G.aabb); C.aabb.combine(A.aabb, F.aabb);
        A.height = 1 + Math.max(B.height, G.height); C.height = 1 + Math.max(A.height, F.height);
      } else {
        C.right = iG; A.right = iF; F.parent = iA;
        A.aabb.combine(B.aabb, F.aabb); C.aabb.combine(A.aabb, G.aabb);
        A.height = 1 + Math.max(B.height, F.height); C.height = 1 + Math.max(A.height, G.height);
      }
      return iC;
    }

    if (balance < -1) {
      const iD = B.left, iE = B.right;
      const D = this.nodes[iD], E = this.nodes[iE];

      B.left = iA; B.parent = A.parent; A.parent = iB;
      if (B.parent !== -1) {
        if (this.nodes[B.parent].left === iA) this.nodes[B.parent].left = iB;
        else this.nodes[B.parent].right = iB;
      } else {
        this.root = iB;
      }

      if (D.height > E.height) {
        B.right = iD; A.left = iE; E.parent = iA;
        A.aabb.combine(C.aabb, E.aabb); B.aabb.combine(A.aabb, D.aabb);
        A.height = 1 + Math.max(C.height, E.height); B.height = 1 + Math.max(A.height, D.height);
      } else {
        B.right = iE; A.left = iD; D.parent = iA;
        A.aabb.combine(C.aabb, D.aabb); B.aabb.combine(A.aabb, E.aabb);
        A.height = 1 + Math.max(C.height, D.height); B.height = 1 + Math.max(A.height, E.height);
      }
      return iB;
    }

    return iA;
  }

  public queryAABB(queryBox: AABB2D, callback: (userData: T) => boolean): void {
    if (this.root === -1) return;

    let stackPtr = 0;
    this.queryStack[stackPtr++] = this.root;

    while (stackPtr > 0) {
      const nodeId = this.queryStack[--stackPtr];
      const node = this.nodes[nodeId];

      if (node.aabb.overlaps(queryBox)) {
        if (node.isLeaf()) {
          if (node.userData !== null) {
            const proceed = callback(node.userData);
            if (!proceed) return;
          }
        } else {
          if (stackPtr + 2 >= this.queryStack.length) this.queryStack.length *= 2;
          this.queryStack[stackPtr++] = node.left;
          this.queryStack[stackPtr++] = node.right;
        }
      }
    }
  }

  public queryRay(origin: Vec2, direction: Vec2, maxFraction: number, callback: (userData: T, fraction: number) => number): void {
    if (this.root === -1) return;

    let stackPtr = 0;
    this.queryStack[stackPtr++] = this.root;
    let currentMaxFraction = maxFraction;

    while (stackPtr > 0) {
      const nodeId = this.queryStack[--stackPtr];
      const node = this.nodes[nodeId];

      const rayRes = node.aabb.raycast(origin, direction, currentMaxFraction);
      if (rayRes.hit) {
        if (node.isLeaf()) {
          if (node.userData !== null) {
            const newFraction = callback(node.userData, rayRes.fraction);
            if (newFraction >= 0) currentMaxFraction = Math.min(currentMaxFraction, newFraction);
          }
        } else {
          if (stackPtr + 2 >= this.queryStack.length) this.queryStack.length *= 2;
          this.queryStack[stackPtr++] = node.left;
          this.queryStack[stackPtr++] = node.right;
        }
      }
    }
  }

  public generatePairs(callback: (a: T, b: T) => void): void {
    if (this.root === -1) return;

    let stackPtr = 0;
    this.pairStackA[stackPtr] = this.root;
    this.pairStackB[stackPtr] = this.root;
    stackPtr++;

    while (stackPtr > 0) {
      stackPtr--;
      const idA = this.pairStackA[stackPtr];
      const idB = this.pairStackB[stackPtr];
      const nodeA = this.nodes[idA];
      const nodeB = this.nodes[idB];

      if (idA === idB) {
        if (!nodeA.isLeaf()) {
          if (stackPtr + 3 >= this.pairStackA.length) {
            this.pairStackA.length *= 2;
            this.pairStackB.length *= 2;
          }
          this.pairStackA[stackPtr] = nodeA.left; this.pairStackB[stackPtr] = nodeA.left; stackPtr++;
          this.pairStackA[stackPtr] = nodeA.right; this.pairStackB[stackPtr] = nodeA.right; stackPtr++;
          this.pairStackA[stackPtr] = nodeA.left; this.pairStackB[stackPtr] = nodeA.right; stackPtr++;
        }
      } else if (nodeA.aabb.overlaps(nodeB.aabb)) {
        if (nodeA.isLeaf() && nodeB.isLeaf()) {
          if (nodeA.userData !== null && nodeB.userData !== null) callback(nodeA.userData, nodeB.userData);
        } else if (nodeA.isLeaf()) {
          if (stackPtr + 2 >= this.pairStackA.length) {
            this.pairStackA.length *= 2; this.pairStackB.length *= 2;
          }
          this.pairStackA[stackPtr] = idA; this.pairStackB[stackPtr] = nodeB.left; stackPtr++;
          this.pairStackA[stackPtr] = idA; this.pairStackB[stackPtr] = nodeB.right; stackPtr++;
} else if (nodeB.isLeaf()) {
          if (stackPtr + 2 >= this.pairStackA.length) {
            this.pairStackA.length *= 2; this.pairStackB.length *= 2;
          }
          this.pairStackA[stackPtr] = nodeA.left; this.pairStackB[stackPtr] = idB; stackPtr++;
          this.pairStackA[stackPtr] = nodeA.right; this.pairStackB[stackPtr] = idB; stackPtr++;
        } else {
          if (stackPtr + 4 >= this.pairStackA.length) {
            this.pairStackA.length *= 2; this.pairStackB.length *= 2;
          }
          this.pairStackA[stackPtr] = nodeA.left; this.pairStackB[stackPtr] = nodeB.left; stackPtr++;
          this.pairStackA[stackPtr] = nodeA.left; this.pairStackB[stackPtr] = nodeB.right; stackPtr++;
          this.pairStackA[stackPtr] = nodeA.right; this.pairStackB[stackPtr] = nodeB.left; stackPtr++;
          this.pairStackA[stackPtr] = nodeA.right; this.pairStackB[stackPtr] = nodeB.right; stackPtr++;
        }
      }
    }
  }
}

export class DynamicBVHTree3D<T> {
  public nodes: BVHNode3D<T>[] = [];
  public root: number = -1;
  public freeList: number[] = [];
  public nodeCount: number = 0;
  public fatMargin: number = 2.0;

  private queryStack: number[] = new Array(256).fill(0);
  private pairStackA: number[] = new Array(512).fill(0);
  private pairStackB: number[] = new Array(512).fill(0);

  constructor(initialCapacity: number = 256) {
    this.allocatePool(initialCapacity);
  }

  private allocatePool(count: number): void {
    const startIdx = this.nodes.length;
    for (let i = 0; i < count; i++) {
      const node = new BVHNode3D<T>();
      node.id = startIdx + i;
      node.parent = -1;
      this.nodes.push(node);
      this.freeList.push(node.id);
    }
  }

  private allocateNode(): number {
    if (this.freeList.length === 0) {
      this.allocatePool(Math.max(64, this.nodes.length));
    }
    const id = this.freeList.pop() ?? 0;
    const node = this.nodes[id];
    node.parent = -1;
    node.left = -1;
    node.right = -1;
    node.height = 0;
    node.userData = null;
    node.moved = false;
    this.nodeCount++;
    return id;
  }

  private freeNode(id: number): void {
    const node = this.nodes[id];
    node.userData = null;
    node.parent = -1;
    node.left = -1;
    node.right = -1;
    node.height = -1;
    this.freeList.push(id);
    this.nodeCount--;
  }

  public createProxy(aabb: AABB3D, userData: T): number {
    const proxyId = this.allocateNode();
    const node = this.nodes[proxyId];
    node.aabb.copy(aabb).fatten(this.fatMargin);
    node.userData = userData;
    node.height = 0;
    node.moved = true;
    this.insertLeaf(proxyId);
    return proxyId;
  }

  public destroyProxy(proxyId: number): void {
    this.removeLeaf(proxyId);
    this.freeNode(proxyId);
  }

  public moveProxy(proxyId: number, aabb: AABB3D, displacement?: Vec3): boolean {
    const node = this.nodes[proxyId];
    if (node.aabb.contains(aabb)) return false;

    this.removeLeaf(proxyId);
    node.aabb.copy(aabb).fatten(this.fatMargin, displacement);
    this.insertLeaf(proxyId);
    node.moved = true;
    return true;
  }

  public getUserData(proxyId: number): T | null {
    return this.nodes[proxyId]?.userData ?? null;
  }

  public getFatAABB(proxyId: number): AABB3D {
    return this.nodes[proxyId].aabb;
  }

  private insertLeaf(leaf: number): void {
    if (this.root === -1) {
      this.root = leaf;
      this.nodes[this.root].parent = -1;
      return;
    }

    const leafAABB = this.nodes[leaf].aabb;
    let sibling = this.root;
    const combined = new AABB3D();

    while (!this.nodes[sibling].isLeaf()) {
      const left = this.nodes[sibling].left;
      const right = this.nodes[sibling].right;

      const area = this.nodes[sibling].aabb.getSurfaceArea();
      combined.combine(this.nodes[sibling].aabb, leafAABB);
      const combinedArea = combined.getSurfaceArea();

      const cost = 2.0 * combinedArea;
      const inheritanceCost = 2.0 * (combinedArea - area);

      let costL: number;
      combined.combine(leafAABB, this.nodes[left].aabb);
      if (this.nodes[left].isLeaf()) {
        costL = combined.getSurfaceArea() + inheritanceCost;
      } else {
        costL = combined.getSurfaceArea() - this.nodes[left].aabb.getSurfaceArea() + inheritanceCost;
      }

      let costR: number;
      combined.combine(leafAABB, this.nodes[right].aabb);
      if (this.nodes[right].isLeaf()) {
        costR = combined.getSurfaceArea() + inheritanceCost;
      } else {
        costR = combined.getSurfaceArea() - this.nodes[right].aabb.getSurfaceArea() + inheritanceCost;
      }

      if (cost < costL && cost < costR) break;
      sibling = costL < costR ? left : right;
    }

    const oldParent = this.nodes[sibling].parent;
    const newParent = this.allocateNode();
    const pNode = this.nodes[newParent];

    pNode.parent = oldParent;
    pNode.aabb.combine(leafAABB, this.nodes[sibling].aabb);
    pNode.height = this.nodes[sibling].height + 1;

    if (oldParent !== -1) {
      if (this.nodes[oldParent].left === sibling) this.nodes[oldParent].left = newParent;
      else this.nodes[oldParent].right = newParent;
    } else {
      this.root = newParent;
    }

    pNode.left = sibling;
    pNode.right = leaf;
    this.nodes[sibling].parent = newParent;
    this.nodes[leaf].parent = newParent;

    let walk: number = this.nodes[leaf].parent;
    while (walk !== -1) {
      walk = this.balance(walk);
      const l = this.nodes[walk].left;
      const r = this.nodes[walk].right;
      this.nodes[walk].height = 1 + Math.max(this.nodes[l].height, this.nodes[r].height);
      this.nodes[walk].aabb.combine(this.nodes[l].aabb, this.nodes[r].aabb);
      walk = this.nodes[walk].parent;
    }
  }

  private removeLeaf(leaf: number): void {
    if (leaf === this.root) {
      this.root = -1;
      return;
    }

    const parent = this.nodes[leaf].parent;
    const grandParent = this.nodes[parent].parent;
    const sibling = this.nodes[parent].left === leaf ? this.nodes[parent].right : this.nodes[parent].left;

    if (grandParent !== -1) {
      if (this.nodes[grandParent].left === parent) this.nodes[grandParent].left = sibling;
      else this.nodes[grandParent].right = sibling;

      this.nodes[sibling].parent = grandParent;
      this.freeNode(parent);

      let walk: number = grandParent;
      while (walk !== -1) {
        walk = this.balance(walk);
        const l = this.nodes[walk].left;
        const r = this.nodes[walk].right;
        this.nodes[walk].aabb.combine(this.nodes[l].aabb, this.nodes[r].aabb);
        this.nodes[walk].height = 1 + Math.max(this.nodes[l].height, this.nodes[r].height);
        walk = this.nodes[walk].parent;
      }
    } else {
      this.root = sibling;
      this.nodes[sibling].parent = -1;
      this.freeNode(parent);
    }
  }

  private balance(iA: number): number {
    const A = this.nodes[iA];
    if (A.isLeaf() || A.height < 2) return iA;

    const iB = A.left, iC = A.right;
    const B = this.nodes[iB], C = this.nodes[iC];
    const balance = C.height - B.height;

    if (balance > 1) {
      const iF = C.left, iG = C.right;
      const F = this.nodes[iF], G = this.nodes[iG];

      C.left = iA; C.parent = A.parent; A.parent = iC;
      if (C.parent !== -1) {
        if (this.nodes[C.parent].left === iA) this.nodes[C.parent].left = iC;
        else this.nodes[C.parent].right = iC;
      } else {
        this.root = iC;
      }

      if (F.height > G.height) {
        C.right = iF; A.right = iG; G.parent = iA;
        A.aabb.combine(B.aabb, G.aabb); C.aabb.combine(A.aabb, F.aabb);
        A.height = 1 + Math.max(B.height, G.height); C.height = 1 + Math.max(A.height, F.height);
      } else {
        C.right = iG; A.right = iF; F.parent = iA;
        A.aabb.combine(B.aabb, F.aabb); C.aabb.combine(A.aabb, G.aabb);
        A.height = 1 + Math.max(B.height, F.height); C.height = 1 + Math.max(A.height, G.height);
      }
      return iC;
    }

    if (balance < -1) {
      const iD = B.left, iE = B.right;
      const D = this.nodes[iD], E = this.nodes[iE];

      B.left = iA; B.parent = A.parent; A.parent = iB;
      if (B.parent !== -1) {
        if (this.nodes[B.parent].left === iA) this.nodes[B.parent].left = iB;
        else this.nodes[B.parent].right = iB;
      } else {
        this.root = iB;
      }

      if (D.height > E.height) {
        B.right = iD; A.left = iE; E.parent = iA;
        A.aabb.combine(C.aabb, E.aabb); B.aabb.combine(A.aabb, D.aabb);
        A.height = 1 + Math.max(C.height, E.height); B.height = 1 + Math.max(A.height, D.height);
      } else {
        B.right = iE; A.left = iD; D.parent = iA;
        A.aabb.combine(C.aabb, D.aabb); B.aabb.combine(A.aabb, E.aabb);
        A.height = 1 + Math.max(C.height, D.height); B.height = 1 + Math.max(A.height, E.height);
      }
      return iB;
    }

    return iA;
  }

  public queryAABB(queryBox: AABB3D, callback: (userData: T) => boolean): void {
    if (this.root === -1) return;

    let stackPtr = 0;
    this.queryStack[stackPtr++] = this.root;

    while (stackPtr > 0) {
      const nodeId = this.queryStack[--stackPtr];
      const node = this.nodes[nodeId];

      if (node.aabb.overlaps(queryBox)) {
        if (node.isLeaf()) {
          if (node.userData !== null) {
            const proceed = callback(node.userData);
            if (!proceed) return;
          }
        } else {
          if (stackPtr + 2 >= this.queryStack.length) this.queryStack.length *= 2;
          this.queryStack[stackPtr++] = node.left; 
          this.queryStack[stackPtr++] = node.right;
        }
      }
    }
  }

  public queryRay(origin: Vec3, direction: Vec3, maxFraction: number, callback: (userData: T, fraction: number) => number): void {
    if (this.root === -1) return;

    let stackPtr = 0;
    this.queryStack[stackPtr++] = this.root;
    let currentMaxFraction = maxFraction;

    while (stackPtr > 0) {
      const nodeId = this.queryStack[--stackPtr];
      const node = this.nodes[nodeId];

      const rayRes = node.aabb.raycast(origin, direction, currentMaxFraction);
      if (rayRes.hit) {
        if (node.isLeaf()) {
          if (node.userData !== null) {
            const newFraction = callback(node.userData, rayRes.fraction);
            if (newFraction >= 0) currentMaxFraction = Math.min(currentMaxFraction, newFraction);
          }
        } else {
          if (stackPtr + 2 >= this.queryStack.length) this.queryStack.length *= 2;
          this.queryStack[stackPtr++] = node.left;
          this.queryStack[stackPtr++] = node.right;
        }
      }
    }
  }

  public generatePairs(callback: (a: T, b: T) => void): void {
    if (this.root === -1) return;

    let stackPtr = 0;
    this.pairStackA[stackPtr] = this.root;
    this.pairStackB[stackPtr] = this.root;
    stackPtr++;

    while (stackPtr > 0) {
      stackPtr--;
      const idA = this.pairStackA[stackPtr];
      const idB = this.pairStackB[stackPtr];
      const nodeA = this.nodes[idA];
      const nodeB = this.nodes[idB];

      if (idA === idB) {
        if (!nodeA.isLeaf()) {
          if (stackPtr + 3 >= this.pairStackA.length) {
            this.pairStackA.length *= 2;
            this.pairStackB.length *= 2;
          }
          this.pairStackA[stackPtr] = nodeA.left; this.pairStackB[stackPtr] = nodeA.left; stackPtr++;
          this.pairStackA[stackPtr] = nodeA.right; this.pairStackB[stackPtr] = nodeA.right; stackPtr++;
          this.pairStackA[stackPtr] = nodeA.left; this.pairStackB[stackPtr] = nodeA.right; stackPtr++;
        }
      } else if (nodeA.aabb.overlaps(nodeB.aabb)) {
        if (nodeA.isLeaf() && nodeB.isLeaf()) {
          if (nodeA.userData !== null && nodeB.userData !== null) callback(nodeA.userData, nodeB.userData);
} else if (nodeA.isLeaf()) {
          if (stackPtr + 2 >= this.pairStackA.length) {
            this.pairStackA.length *= 2; this.pairStackB.length *= 2;
          }
          this.pairStackA[stackPtr] = idA; this.pairStackB[stackPtr] = nodeB.left; stackPtr++;
          this.pairStackA[stackPtr] = idA; this.pairStackB[stackPtr] = nodeB.right; stackPtr++;
        } else if (nodeB.isLeaf()) {
          if (stackPtr + 2 >= this.pairStackA.length) {
            this.pairStackA.length *= 2; this.pairStackB.length *= 2;
          }
          this.pairStackA[stackPtr] = nodeA.left; this.pairStackB[stackPtr] = idB; stackPtr++;
          this.pairStackA[stackPtr] = nodeA.right; this.pairStackB[stackPtr] = idB; stackPtr++;
        } else {
          if (stackPtr + 4 >= this.pairStackA.length) {
            this.pairStackA.length *= 2; this.pairStackB.length *= 2;
          }
          this.pairStackA[stackPtr] = nodeA.left; this.pairStackB[stackPtr] = nodeB.left; stackPtr++;
          this.pairStackA[stackPtr] = nodeA.left; this.pairStackB[stackPtr] = nodeB.right; stackPtr++;
          this.pairStackA[stackPtr] = nodeA.right; this.pairStackB[stackPtr] = nodeB.left; stackPtr++;
          this.pairStackA[stackPtr] = nodeA.right; this.pairStackB[stackPtr] = nodeB.right; stackPtr++;
        }
      }
    }
  }
}
