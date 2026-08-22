import { DimensionMode, IDimensionalEngine } from '../physics/common/types';

export type SensorCallback = (active: boolean, msg?: string) => void;

/**
 * MotionSensorManager - Real-World Gyroscope & Accelerometer Sensor Manager.
 * Features Low-Pass Noise Filtering, Desktop Virtual Tilt Emulation,
 * iOS 13+ Permission Handling, and Cross-Dimensional Dynamic Gravity Steering.
 */
export class MotionSensorManager {
  public isEnabled: boolean = false;
  public isSupported: boolean = false;
  public isVirtual: boolean = false;

  // Filtered Euler orientation angles in degrees
  public pitch: number = 0; // Beta (-180 to 180, front-to-back tilt)
  public roll: number = 0;  // Gamma (-90 to 90, left-to-right tilt)
  public yaw: number = 0;   // Alpha (0 to 360, compass heading)

  // Filtered Linear Acceleration (m/s^2)
  public accelX: number = 0;
  public accelY: number = 0;
  public accelZ: number = 0;

  // Base gravity magnitude synced from physics slider
  public baseMagnitude: number = 980;

  // Smoothing parameter for Low-Pass Filter (0.0: static, 1.0: raw unfiltered)
  public filterCoeff: number = 0.22;

  // Shake detection timestamp
  public lastShakeTime: number = 0;

  private onOrientationBound: (evt: DeviceOrientationEvent) => void;
  private onMotionBound: (evt: DeviceMotionEvent) => void;
  private onMouseMoveVirtualBound: (evt: MouseEvent) => void;
  private listeners: SensorCallback[] = [];

  constructor() {
    this.isSupported = typeof window !== 'undefined' && ('DeviceOrientationEvent' in window || 'ondeviceorientation' in window);
    this.onOrientationBound = this.handleOrientation.bind(this);
    this.onMotionBound = this.handleMotion.bind(this);
    this.onMouseMoveVirtualBound = this.handleVirtualTilt.bind(this);
  }

  public subscribe(cb: SensorCallback): void {
    this.listeners?.push(cb);
  }

  private notify(active: boolean, msg?: string): void {
    const list = this.listeners;
    const len = list.length;
    for (let i = 0; i < len; i++) {
      const fn = list.at(i);
      if (fn) fn(active, msg);
    }
  }

  /**
   * Requests User Permission and activates Motion Sensors (or Desktop Virtual Tilt Fallback).
   */
  public async enable(): Promise<boolean> {
    try {
      // iOS 13+ Safari Permission Request
      const anyDOE = typeof DeviceOrientationEvent !== 'undefined'
        ? (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> })
        : null;

      if (anyDOE && typeof anyDOE.requestPermission === 'function') {
        const response = await anyDOE.requestPermission();
        if (response !== 'granted') {
          this.notify(false, 'Permission denied for motion sensors.');
          return false;
        }
      }

      if (typeof window !== 'undefined') {
        window.addEventListener('deviceorientation', this.onOrientationBound, true);
        window.addEventListener('devicemotion', this.onMotionBound, true);
        // Desktop mouse tilt emulation when holding Alt or moving near edges
        window.addEventListener('mousemove', this.onMouseMoveVirtualBound, true);
      }

      this.isEnabled = true;
      this.notify(true, 'Motion sensors connected.');
      return true;
    } catch (err) {
      this.notify(false, `Failed to enable sensors: ${String(err)}`);
      return false;
    }
  }

  public disable(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('deviceorientation', this.onOrientationBound, true);
      window.removeEventListener('devicemotion', this.onMotionBound, true);
      window.removeEventListener('mousemove', this.onMouseMoveVirtualBound, true);
    }
    this.isEnabled = false;
    this.pitch = 0;
    this.roll = 0;
    this.yaw = 0;
    this.accelX = 0;
    this.accelY = 0;
    this.accelZ = 0;
    this.notify(false, 'Motion sensors disabled.');
  }

  public toggle(): Promise<boolean> {
    if (this.isEnabled) {
      this.disable();
      return Promise.resolve(false);
    }
    return this.enable();
  }

  private handleOrientation(evt: DeviceOrientationEvent): void {
    if (evt.beta === null && evt.gamma === null) {
      return;
    }

    const rawBeta = Number.isFinite(evt.beta) ? (evt.beta ?? 0) : 0;
    const rawGamma = Number.isFinite(evt.gamma) ? (evt.gamma ?? 0) : 0;
    const rawAlpha = Number.isFinite(evt.alpha) ? (evt.alpha ?? 0) : 0;

    const k = this.filterCoeff;
    this.pitch += k * (rawBeta - this.pitch);
    this.roll += k * (rawGamma - this.roll);
    this.yaw += k * (rawAlpha - this.yaw);
  }

  private handleVirtualTilt(evt: MouseEvent): void {
    // On desktop, if user holds Alt key or moves near edges, tilt emulation activates
    if (evt.altKey) {
      const cx = window.innerWidth * 0.5;
      const cy = window.innerHeight * 0.5;
      const normX = (evt.clientX - cx) / Math.max(100, cx);
      const normY = (evt.clientY - cy) / Math.max(100, cy);

      const targetRoll = Math.max(-60, Math.min(60, normX * 45));
      const targetPitch = Math.max(-60, Math.min(60, normY * 45));

      const k = 0.15;
      this.roll += k * (targetRoll - this.roll);
      this.pitch += k * (targetPitch - this.pitch);
    }
  }

  private handleMotion(evt: DeviceMotionEvent): void {
    const acc = evt.accelerationIncludingGravity || evt.acceleration;
    if (!acc) return;

    const rawX = Number.isFinite(acc.x) ? (acc.x ?? 0) : 0;
    const rawY = Number.isFinite(acc.y) ? (acc.y ?? 0) : 0;
    const rawZ = Number.isFinite(acc.z) ? (acc.z ?? 0) : 0;

    const k = this.filterCoeff;
    this.accelX += k * (rawX - this.accelX);
    this.accelY += k * (rawY - this.accelY);
    this.accelZ += k * (rawZ - this.accelZ);
  }

  /**
   * Translates real-world gyro angles & accelerations directly into the active dimensional engine.
   */
  public updateDimensionalGravity(
    dimension: DimensionMode,
    engine: IDimensionalEngine,
    baseMagnitude: number = 980
  ): void {
    if (!this.isEnabled) return;

    this.baseMagnitude = baseMagnitude;
    const degToRad = Math.PI / 180;
    const pitchRad = this.pitch * degToRad;
    const rollRad = this.roll * degToRad;

    // Tilt magnitude check
    const tiltMagSq = this.pitch * this.pitch + this.roll * this.roll;

    if (dimension === '2d') {
      if (tiltMagSq < 1.0) {
        // Flat on table or baseline: full downward gravity
        engine?.setGravity(0, baseMagnitude);
      } else {
        const gx = baseMagnitude * Math.sin(rollRad);
        // Positive pitch tilts down, roll tilts sideways
        const gy = baseMagnitude * Math.cos(rollRad) * Math.sin(pitchRad + Math.PI * 0.5);
        engine?.setGravity(gx, Math.max(100, gy));
      }
    } else if (dimension === '3d') {
      if (tiltMagSq < 1.0) {
        engine?.setGravity(0, -baseMagnitude, 0);
      } else {
        const gx = baseMagnitude * Math.sin(rollRad);
        const gy = -baseMagnitude * Math.cos(pitchRad) * Math.cos(rollRad);
        const gz = baseMagnitude * Math.sin(pitchRad);
        engine?.setGravity(gx, gy, gz);
      }
    } else if (dimension === '4d') {
      if (tiltMagSq < 1.0) {
        engine?.setGravity(0, -baseMagnitude, 0, 0);
      } else {
        const gx = baseMagnitude * Math.sin(rollRad);
        const gy = -baseMagnitude * Math.cos(pitchRad) * Math.cos(rollRad);
        const gz = baseMagnitude * Math.sin(pitchRad);
        engine?.setGravity(gx, gy, gz, 0);
      }

      // Check for sudden device shake -> trigger 4D hyper-rotational surge
      const totalAccel = Math.sqrt(
        this.accelX * this.accelX +
        this.accelY * this.accelY +
        this.accelZ * this.accelZ
      );

      const now = performance.now();
      if (totalAccel > 18.0 && now - this.lastShakeTime > 800) {
        this.lastShakeTime = now;
        engine?.applyExplosion({ x: 0, y: 200, z: 0, w: 0 }, 400, 1500);
      }
    }
  }
}
