import React, { useEffect, useRef, useState } from 'react';
import Peaks, { PeaksInstance } from 'peaks.js';

import { createPointMarker, createSegmentMarker } from './MarkerFactories';
import { createSegmentLabel } from './SegmentLabelFactory';

import classes from './WaveformView.module.css';

export type WaveformViewPoint = { labelText: string; time: number };

type Props = {
  audioElement: HTMLAudioElement;
  /**
   * Precomputed binary waveform data for the audio file (.dat extension)
   * generated by https://github.com/bbc/audiowaveform
   * and already processed into an ArrayBuffer
   *
   * used by peaks.js to display the waveforms of the audio
   *
   * If supplied, neither audioContext nor audioBuffer are required
   */
  waveformDataBuffer?: ArrayBuffer;
  /**
   * URI pointing to precomputed waveform data (either binary .dat file or JSON) generated by https://github.com/bbc/audiowaveform
   *
   * peaks.js will use it internally to fetch data from the URI and generate the waveforms
   *
   * Caution: will fail if server serving the waveform data is not on same origin and does not support CORS
   *
   * If supplied, neither audioContext nor audioBuffer are required
   */
  // waveformDataUri?: string; // not supported for now, probably better if peaks just gets waveformdata right away instead of fetching internally
  /**
   * used by peaks.js to generate (and then display) the waveform data from the audio file referenced in audioUrl (=== the audio element's src)
   *
   * peaks will fetch the audio via network internally
   *
   * Caution: if the server serving the audio file (under audioUrl) is not on same origin and does not support CORS, this approach will fail!
   *
   * If supplied, audioUrl is also required for "change detection" to work
   *
   * However, neither waveformDataBuffer nor audioBuffer are required
   */
  audioContext?: AudioContext;
  /**
   * audio data retrieved using decodeData() of some AudioContext
   *
   * used by peaks.js to compute the waveform data on the client
   *
   * If supplied, neither waveformDataBuffer nor audioContext are required
   */
  audioBuffer?: AudioBuffer;
  /**
   * CSS color string for waveform zoom view color
   */
  waveformZoomviewColor?: string;
  /**
   * called when peaks instance is ready
   */
  onPeaksReady?: (peaks: Peaks.PeaksInstance) => void;
  points?: WaveformViewPoint[];
  /**
   * URL pointing to the audio file whose waveform data should be displayed by peaks.js
   *
   * Required when using audioContext for waveform data generation
   *
   */
  audioUrl?: string;
  /**
   * NOT USED ATM
   */
  audioContentType?: string;
  /**
   * NOT USED ATM
   */
  setSegments?: Function;
  /**
   * NOT USED ATM
   */
  setPoints?: Function;
};

// this file and all related files were adapted from https://github.com/chrisn/peaksjs-react-example
// the initial code was written in JS and I have very little knowledge of this library
// so, the code that made all of this kinda work is very ugly and hacky lol
const WaveformView = ({
  audioElement,
  audioUrl,
  waveformDataBuffer,
  audioContext,
  audioBuffer,
  waveformZoomviewColor,
  onPeaksReady,
  points,
}: Props) => {
  const zoomviewWaveformRef = useRef<HTMLDivElement>(null);
  const overviewWaveformRef = useRef<HTMLDivElement>(null);
  // audioElementRef: any;
  const [peaks, setPeaks] = useState<PeaksInstance | null>(null);

  useEffect(() => {
    const viewContainerOptions: Peaks.ViewContainerOptions = {
      containers: {
        overview: overviewWaveformRef.current,
        zoomview: zoomviewWaveformRef.current,
      },
    };

    const audioOpts = getPeaksAudioOptions({
      waveformDataBuffer,
      audioBuffer,
      audioContext,
    });

    if (!audioOpts) {
      throw Error(
        'Please provide either waveformData, audioBuffer or audioContext!'
      );
    }

    const optionalOptions: Peaks.OptionalOptions = {
      // mediaElement: audioElementRef.current,
      mediaElement: audioElement,
      keyboard: false, // we control keybindings from parent
      logger: console.error.bind(console),
      createSegmentMarker: createSegmentMarker,
      createSegmentLabel: createSegmentLabel,
      createPointMarker: createPointMarker,
      // zoomWaveformColor: props.waveformZoomviewColor, // doesn't work for some reason
    };

    const options: Peaks.PeaksOptions = {
      ...viewContainerOptions,
      ...optionalOptions,
      ...audioOpts,
    };

    if (peaks) {
      peaks.destroy();
      setPeaks(null);
    }

    Peaks.init(options, (err, peaks) => {
      if (err) {
        console.error(
          'An error occurred while initializing Peaks.js',
          err instanceof MediaError ? 'code: ' + err.code : '',
          err.message
        );
      }
      if (peaks) {
        const zoomview = peaks.views.getView('zoomview');
        if (waveformZoomviewColor) {
          zoomview?.setWaveformColor(waveformZoomviewColor);
        }
        setPeaks(peaks);
        console.log('Peaks.js is ready');
        onPeaksReady?.(peaks);
      } else console.error('Peaks not initialized!');
    });

    return () => {
      console.log('destroying peaks');
      peaks?.destroy();
    };
  }, [
    audioBuffer,
    audioContext,
    audioElement,
    audioUrl, // when using audioContext for waveform data creation, change would not be detected with the given deps array; so, as a workaround this is added as dep to make sure change in audio file is reflected in component
    onPeaksReady,
    // peaks,
    waveformDataBuffer,
    // waveformZoomviewColor,
  ]); // TODO: figure out what meaningful dependencies are

  useEffect(() => {
    if (points && peaks) {
      peaks.points.removeAll();
      points.forEach(p => peaks.points.add(p));
    } else {
    }
  }, [points, peaks]);

  return (
    <div>
      <div
        className={classes['zoomview-container']}
        ref={zoomviewWaveformRef}
      ></div>
      <div
        className={classes['overview-container']}
        ref={overviewWaveformRef}
      ></div>
    </div>
  );
};

export default WaveformView;

function getPeaksAudioOptions({
  waveformDataBuffer,
  audioBuffer,
  audioContext,
}: {
  waveformDataBuffer: ArrayBuffer | undefined;
  audioBuffer: AudioBuffer | undefined;
  audioContext: AudioContext | undefined;
}): Peaks.AudioOptions | undefined {
  if (waveformDataBuffer) {
    console.log('WaveformView using waveform data buffer');
    return {
      waveformData: {
        arraybuffer: waveformDataBuffer,
      },
    };
  }
  if (audioBuffer) {
    console.log('WaveformView using AudioBuffer');
    return {
      webAudio: {
        audioBuffer,
      },
    };
  }
  if (audioContext) {
    console.log('WaveformView using AudioContext');
    return {
      webAudio: {
        audioContext,
      },
    };
  }
}
