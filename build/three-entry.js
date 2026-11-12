import { Scene, PerspectiveCamera, WebGLRenderer, BufferGeometry, BufferAttribute, Mesh, MeshBasicMaterial,
  CanvasTexture, Color, Vector2, Vector3, Raycaster, Group, SRGBColorSpace, LinearFilter, LinearMipmapLinearFilter,
  MOUSE, TOUCH, DoubleSide, Points, PointsMaterial, Sphere, Box3 } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
window.T3 = { Scene, PerspectiveCamera, WebGLRenderer, BufferGeometry, BufferAttribute, Mesh, MeshBasicMaterial,
  CanvasTexture, Color, Vector2, Vector3, Raycaster, Group, SRGBColorSpace, LinearFilter, LinearMipmapLinearFilter,
  MOUSE, TOUCH, DoubleSide, Points, PointsMaterial, Sphere, Box3,
  OrbitControls, LineSegments2, Line2, LineMaterial, LineGeometry, LineSegmentsGeometry };
