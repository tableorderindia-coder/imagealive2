import type * as React from 'react';

type AFrameHTMLElementProps = React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
  position?: string;
  rotation?: string;
  scale?: string;
  material?: string;
  src?: string;
  width?: string | number;
  height?: string | number;
  'look-controls'?: string;
};
type AFrameVideoProps = React.DetailedHTMLProps<React.VideoHTMLAttributes<HTMLVideoElement>, HTMLVideoElement>;

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'a-scene': AFrameHTMLElementProps & {
        'mindar-image'?: string;
        'color-space'?: string;
        'renderer'?: string;
        'vr-mode-ui'?: string;
        'device-orientation-permission-ui'?: string;
      };
      'a-assets': AFrameHTMLElementProps;
      'a-camera': AFrameHTMLElementProps;
      'a-entity': AFrameHTMLElementProps & {
        'mindar-image-target'?: string;
      };
      'a-plane': AFrameHTMLElementProps;
      'a-video': AFrameVideoProps;
    }
  }
}

export {};
