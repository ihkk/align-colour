import logo from './logo.svg';
import './App.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import React, { useState, useEffect, useRef } from 'react';

function App() {

  const sourceCanvasRef = useRef(null);
  const targetCanvasRef = useRef(null);
  const resultCanvasRef = useRef(null);
  const [sourceLoaded, setSourceLoaded] = useState(false);
  const [targetLoaded, setTargetLoaded] = useState(false);
  const [sourceFileName, setSourceFileName] = useState('source'); // Default source name
  const [targetFileName, setTargetFileName] = useState('source'); // Default source name

  const downloadResult = () => {
    const resultCanvas = resultCanvasRef.current;
    if (resultCanvas) {
      const dataURL = resultCanvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = dataURL;
      link.download = `${sourceFileName}_lut_${targetFileName}.png`; // Dynamic file name
      link.click();
    }
  };

  // Share the result canvas image using the Web Share API
  const shareResult = async () => {
    const resultCanvas = resultCanvasRef.current;
    if (resultCanvas) {
      const blob = await new Promise((resolve) => resultCanvas.toBlob(resolve, "image/png"));
      if (navigator.share && blob) {
        const file = new File([blob], `${sourceFileName}_lut_${targetFileName}.png`, { type: "image/png" });
        navigator.share({
          files: [file],
          title: "Color-Aligned Image",
          text: "Check out this color-aligned image created in the FYP Demo!",
        }).catch((error) => console.log("Sharing failed", error));
      } else {
        alert("Your browser does not support the Web Share API for sharing files.");
      }
    }
  };

  const handleUpload = (e, canvasRef, setLoaded, setFileName) => {
    setLoaded(false); // Reset the flag to ensure re-rendering
    const file = e.target.files[0];
    if (file) {
      if (setFileName) {
        setFileName(file.name.split('.')[0]); // Set file name without extension
      }
      displayImageOnCanvas(file, canvasRef, setLoaded);
    }
  };



  const applyHistogramMatching = () => {
    const sourceCanvas = sourceCanvasRef.current;
    const targetCanvas = targetCanvasRef.current;
    const resultCanvas = resultCanvasRef.current;

    if (!sourceCanvas || !targetCanvas || !resultCanvas) return;

    const sourceCtx = sourceCanvas.getContext('2d');
    const targetCtx = targetCanvas.getContext('2d');
    const resultCtx = resultCanvas.getContext('2d');

    // Get image data from the source and target canvases
    const sourceImageData = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    const targetImageData = targetCtx.getImageData(0, 0, targetCanvas.width, targetCanvas.height);
    console.log("Source Image Data", sourceImageData);
    console.log("Target Image Data", targetImageData);
    // Perform histogram matching on each RGB channel
    const matchedData = matchHistogram(sourceImageData, targetImageData);

    // Set result canvas dimensions and ensure it’s cleared
    resultCanvas.width = matchedData.width;
    resultCanvas.height = matchedData.height;
    resultCtx.clearRect(0, 0, resultCanvas.width, resultCanvas.height);

    // Debug log to verify content before rendering
    console.log("Rendering Matched Data on Result Canvas", matchedData);

    // Draw the matched image data on the result canvas
    resultCtx.putImageData(matchedData, 0, 0);
  };



  const matchHistogram = (sourceData, targetData) => {
    const { width, height, data: sourcePixels } = sourceData;
    const { data: targetPixels } = targetData;

    const resultData = new ImageData(width, height);

    for (let channel = 0; channel < 3; channel++) { // RGB channels only
      const sourceChannel = extractChannel(sourcePixels, channel);
      const targetChannel = extractChannel(targetPixels, channel);
      // Apply histogram matching
      const matchedChannel = histogramMatchChannel(sourceChannel, targetChannel);
      // Place matched channel back into result data
      applyChannel(resultData.data, matchedChannel, channel);
    }
    console.log("Result Data", resultData);
    return resultData;
  };

  const extractChannel = (pixels, channel) => {
    const channelData = [];
    for (let i = channel; i < pixels.length; i += 4) {
      channelData.push(pixels[i]);
    }
    return channelData;
  };

  const applyChannel = (pixels, channelData, channel) => {
    for (let i = 0; i < channelData.length; i++) {
      pixels[i * 4 + channel] = channelData[i]; // Set the channel (R, G, or B)
      pixels[i * 4 + 3] = 255; // Set alpha to 255 (fully opaque)
    }
  };


  const histogramMatchChannel = (sourceChannel, targetChannel) => {
    const sourceHistogram = getHistogram(sourceChannel);
    const targetHistogram = getHistogram(targetChannel);

    const sourceCDF = getCDF(sourceHistogram);
    const targetCDF = getCDF(targetHistogram);
    // Build LUT for mapping source to target, initializing to handle missing values
    const LUT = new Uint8Array(256);
    let targetIndex = 0;

    for (let srcValue = 0; srcValue < 256; srcValue++) {
      // Ensure targetIndex stays within bounds and skips empty target CDF values
      while (targetIndex < 255 && targetCDF[targetIndex] < sourceCDF[srcValue]) {
        targetIndex++;
      }
      LUT[srcValue] = targetIndex; // Map source to nearest target level
    }

    // Apply LUT to the source channel
    return sourceChannel.map(value => LUT[value]);
  };

  const getHistogram = (channelData) => {
    const histogram = new Array(256).fill(0);
    channelData.forEach(value => histogram[value]++);
    // console.log("Histogram", histogram);
    return histogram;
  };

  const getCDF = (histogram) => {
    const cdf = new Array(256).fill(0);
    cdf[0] = histogram[0];
    for (let i = 1; i < histogram.length; i++) {
      cdf[i] = cdf[i - 1] + histogram[i];
    }
    return cdf.map(value => value / cdf[cdf.length - 1]); // Normalize
  };

  // Display image on canvas function
  const displayImageOnCanvas = (file, canvasRef, setLoaded) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, img.width, img.height);
        setLoaded(true); // Mark as loaded
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };


  useEffect(() => {
    if (sourceLoaded && targetLoaded) {
      applyHistogramMatching(); // Automatically apply when both images are loaded
    }
  }, [sourceLoaded, targetLoaded]);



  return (
    <div className="App">
      <div className="container">
        <header className="d-flex flex-wrap justify-content-between align-items-center py-3 border-bottom">
          <a href="." className="d-flex align-items-center text-dark text-decoration-none">
            <span className="fs-4">Colour Alignment Playground</span>
          </a>


        </header>

        <div className="container mt-4">
          <div className="row">
            <div className="col-md-4 text-start">
              <h5>Source Image</h5><h6>Your original photo</h6>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleUpload(e, sourceCanvasRef, setSourceLoaded, setSourceFileName)}
                className="form-control mt-2"
                title="Click or paste an image"
              />
              <canvas ref={sourceCanvasRef} id="sourceCanvas" className="w-100 border mt-2"></canvas>
            </div>
            <div className="col-md-4 text-start">
              <h5>Target Image</h5><h6>The sceenshot as the colour reference</h6>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleUpload(e, targetCanvasRef, setTargetLoaded, setTargetFileName)}
                className="form-control mt-2"
                title="Click or paste an image"
              />
              <canvas ref={targetCanvasRef} id="targetCanvas" className="w-100 border mt-2"></canvas>
            </div>
            <div className="col-md-4 text-start">
              <h5>Result</h5>
              {/* <button onClick={applyHistogramMatching} className="btn btn-secondary mt-2">Apply Colour Alignment</button> */}
              <canvas ref={resultCanvasRef} id="resultCanvas" className="w-100 border mt-2"></canvas>
              <button onClick={downloadResult} className="btn btn-primary mt-2 me-2">
                <i className="bi bi-download me-1"></i>Download
              </button>
              <button onClick={shareResult} className="btn btn-secondary mt-2">
                <i className="bi bi-share me-1"></i>Share
              </button>


            </div>

          </div>

        </div>



        <footer class="d-flex flex-wrap justify-content-between align-items-center py-3 my-4 border-top">
          <div class="col-9 d-flex align-items-center">
            <span class="mb-md-0 text-muted">
              ©
              <a href="https://github.com/ihkk" class="link text-muted" target="_blank" style={{ textDecoration: "none" }}>Kai HE</a>            </span>
          </div>

        </footer>
      </div>
    </div>
  );
}

export default App;
