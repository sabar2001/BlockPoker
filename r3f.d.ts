/// <reference types="@react-three/fiber" />
import { extend } from '@react-three/fiber';
declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}
