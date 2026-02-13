// Make this a module so declare global works
export {};

declare global {
  namespace JSX {
    interface IntrinsicElements {
      // Three.js primitives
      group: any;
      mesh: any;
      line: any;
      points: any;
      
      // Geometries
      boxGeometry: any;
      sphereGeometry: any;
      cylinderGeometry: any;
      planeGeometry: any;
      circleGeometry: any;
      torusGeometry: any;
      coneGeometry: any;
      
      // Materials  
      meshStandardMaterial: any;
      meshBasicMaterial: any;
      lineBasicMaterial: any;
      
      // Lights
      ambientLight: any;
      directionalLight: any;
      pointLight: any;
      spotLight: any;
      hemisphereLight: any;
      
      // Helpers
      color: any;
      fog: any;
      
      // Allow all other R3F elements
      [elemName: string]: any;
    }
  }
}
