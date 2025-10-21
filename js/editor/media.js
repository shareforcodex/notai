import { globalDevices } from "../state.js";



export const mediaMethods = {

  async handleFileSelection(file, previewArea, filePreview) {
    // Show preview area
    previewArea.style.display = 'block';
    filePreview.innerHTML = '';

    // Create and add file info element
    const fileInfo = document.createElement('div');
    fileInfo.style.fontSize = '12px';
    fileInfo.style.color = '#666';
    fileInfo.style.marginBottom = '8px';
    fileInfo.innerHTML = `
      <strong>File:</strong> ${file.name}<br>
      <strong>Type:</strong> ${file.type || 'Unknown'}<br>
      <strong>Size:</strong> ${this.formatFileSize(file.size)}
    `;

    // Handle different file types
    if (file.type.startsWith('image/')) {
      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      filePreview.appendChild(img);

    } else if (file.type.startsWith('video/')) {
      const video = document.createElement('video');
      video.controls = true;
      video.src = URL.createObjectURL(file);
      filePreview.appendChild(video);
    } else if (file.type.startsWith('audio/')) {
      const audio = document.createElement('audio');
      audio.controls = true;
      audio.src = URL.createObjectURL(file);
      filePreview.appendChild(audio);
    } else {
      const fileDetails = document.createElement('div');
      fileDetails.style.padding = '10px';
      fileDetails.style.backgroundColor = '#f5f5f5';
      fileDetails.style.borderRadius = '4px';
      fileDetails.textContent = `File ready for upload`;
      filePreview.appendChild(fileDetails);
    }
    filePreview.appendChild(fileInfo);

  },

  formatFileSize(bytes) {
    if (!bytes) return '0 Bytes';
    const units = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / Math.pow(1024, exponent);
    const formatter = new Intl.NumberFormat(undefined, {
      maximumFractionDigits: exponent === 0 ? 0 : 2,
    });
    return `${formatter.format(value)} ${units[exponent]}`;
  },

  async calculateSHA1(file) {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-1', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  },

  async uploadFile(file, ifInsertElement = true, appendInfo = false) {
    try {
      // Show loading spinner
      this.showSpinner();

      // Calculate SHA1 hash
      const shaCode = await this.calculateSHA1(file);
      const extension = file.name.split('.').pop().toLowerCase();
      const uploadUrl = `https://sharefile.suisuy.eu.org/${shaCode}.${extension}`;

      // Upload file
      const response = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type
        }
      });

      if (response.ok) {
        // Get device info if available
        let deviceInfo = '';
        if (file.type.startsWith('video/') || file.type.startsWith('image/')) {
          const videoDevice = document.getElementById('videoDevices')?.selectedOptions[0]?.text;
          if (videoDevice && appendInfo) {
            deviceInfo = `<strong>Camera:</strong> ${videoDevice}<br>`;
          }
        }
        if (file.type.startsWith('audio/') || file.type.startsWith('video/')) {
          const audioDevice = document.getElementById('audioDevices')?.selectedOptions[0]?.text;
          if (audioDevice && appendInfo) {
            deviceInfo += `<strong>Microphone:</strong> ${audioDevice}<br>`;
          }
        }

        // Create file info div
        const fileInfoDiv = document.createElement('div');
        fileInfoDiv.style.fontSize = '12px';

        let fileURL = `https://pub-cb2c87ea7373408abb1050dd43e3cd8e.r2.dev/${shaCode}.${extension}`;
        if (!ifInsertElement) {
          return fileURL;
        }
        if (appendInfo) {
          fileInfoDiv.innerHTML = `
          <a href="${fileURL}" target="_blank">link</a><br>
          ${file.type || 'Unknown type'} 
          ${this.formatFileSize(file.size)} 
          ${deviceInfo} 
          ${new Date().toLocaleString()}
          <br> <br>
        `;
        }
        else {
          fileInfoDiv.innerHTML = `
          <a href="${fileURL}" target="_blank">link</a><br>
          `;

        }


        // Create appropriate element based on file type
        let element;
        if (file.type.startsWith('image/')) {
          element = document.createElement('img');
          element.src = fileURL;
          element.alt = file.name;
        } else if (file.type.startsWith('video/')) {
          element = document.createElement('video');
          element.src = fileURL;
          element.controls = true;
        } else if (file.type.startsWith('audio/')) {
          element = document.createElement('audio');
          element.src = fileURL;
          element.controls = true;
        } else {
          element = document.createElement('iframe');
          element.src = fileURL;
          element.style.height = '500px';
          element.setAttribute('allowfullscreen', 'true');
        }

        // Create a new block for the media
        let brelement = document.createElement('br');
        const selection = window.getSelection();
        let block = this.currentBlock;

        if (!block) {
          block = document.createElement('div');
          block.className = 'block';
          if (selection.rangeCount > 0 && this.editor.contains(selection.getRangeAt(0)?.commonAncestorContainer)) {
            const range = selection.getRangeAt(0);

            range.insertNode(brelement);
            brelement.after(block);
            block.after(document.createElement('br'));
          } else {
            // If no selection, append to the end of editor
            this.editor.prepend(brelement);
            this.editor.prepend(block);
            this.editor.prepend(document.createElement('br'));

            // Scroll to the newly added content
          }
        }
        block.appendChild(element);
        block.appendChild(fileInfoDiv);
        block.appendChild(document.createElement('br'))
        block.appendChild(document.createElement('br'))
        //check range inside editor
        setTimeout(() => {
          element.scrollIntoView(true, { behavior: 'smooth' });

        }, 800);

        this.showToast('File uploaded successfully!', 'success');
        this.saveNote();
        return fileURL;
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      this.showToast('Failed to upload file: ' + error.message);
    } finally {
      this.hideSpinner();
    }
  },

  async setupMediaDevices() {
    try {
      globalDevices.mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      const audioDevices = devices.filter(device => device.kind === 'audioinput');

      const videoSelect = document.getElementById('videoDevices');
      const audioSelect = document.getElementById('audioDevices');

      // Clear existing options
      videoSelect.innerHTML = '<option value="">Select Camera</option>';
      audioSelect.innerHTML = '<option value="">Select Microphone</option>';

      // Add video devices and select first one by default
      videoDevices.forEach((device, index) => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.text = device.label || `Camera ${videoSelect.length}`;
        videoSelect.appendChild(option);
        // Select first device by default
        if (index === 0) {
          option.selected = true;

        }
      });

      // Add audio devices and select first one by default
      audioDevices.forEach((device, index) => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.text = device.label || `Microphone ${audioSelect.length}`;
        audioSelect.appendChild(option);
        // Select first device by default
        if (index === 0) {
          option.selected = true;
        }
      });

      // Show device selectors if devices are available
      const deviceSelectors = document.querySelector('.device-selectors');
      if (videoDevices.length > 0 || audioDevices.length > 0) {
        deviceSelectors.style.display = 'flex';
      }
    } catch (error) {
      console.error('Error enumerating devices:', error);
      this.showToast('Error accessing media devices');
    }
    clearTimeout(this.stoptrackTimeoutid)
    // this.stoptrackTimeoutid= setTimeout(() => {
    //   this.stopMediaTracks();
    // }, 120000);

    //add a one time event listener to stop media tracks when unfocused tab


  },

  stopMediaTracks() {
    // Check if the stream exists and has tracks
    if (globalDevices.mediaStream && globalDevices.mediaStream.getTracks) {
      console.log("Stopping media stream tracks...");
      globalDevices.mediaStream.getTracks().forEach(track => {
        track.stop(); // Stop each track (video and audio)
        console.log(`Track stopped: ${track.kind} - ${track.label}`);
      });
      console.log("All tracks stopped.");

      // Optional: Clear the reference to the stream object
      // This helps with garbage collection and prevents accidental reuse.
      globalDevices.mediaStream = null;
    } else {
      console.log("No active media stream to stop.");
    }
  },

  async startMediaStream(videoDeviceId = null, includeAudio = false) {
    try {
      const constraints = {
        video: videoDeviceId ? { deviceId: { exact: videoDeviceId } } : true,
        audio: includeAudio ? { echoCancellation: false, noiseSuppression: false } : false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const videoPreview = document.getElementById('videoPreview');
      //this is important to mute the video to avoid noise
      videoPreview.muted = true;

      videoPreview.srcObject = stream;
      videoPreview.style.display = 'block';
      document.getElementById('mediaPreview').style.display = 'block';
      await videoPreview.play(); // Ensure video is playing before returning
      return stream;
    } catch (error) {
      console.error('Error accessing media:', error);
      this.showToast('Error accessing camera or microphone');
      return null;
    }
  },

  async capturePhoto(stream) {
    const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
    const videoPreview = document.getElementById('videoPreview');
    const canvas = document.getElementById('photoCanvas');
    const context = canvas.getContext('2d');
    const videoDevice = document.getElementById('videoDevices').selectedOptions[0].text;
    try {
      // Wait for video metadata to load
      await new Promise((resolve) => {
        if (videoPreview.readyState >= 2) {
          resolve();
        } else {
          videoPreview.onloadeddata = () => resolve();
        }
      });

      // Set canvas dimensions to match video
      canvas.width = videoPreview.videoWidth;
      canvas.height = videoPreview.videoHeight;

      // Draw video frame to canvas
      context.drawImage(videoPreview, 0, 0);

      // Convert canvas to blob
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.95));

      // Stop the stream and hide video preview
      globalDevices.mediaStream.getTracks().forEach(track => track.stop());
      videoPreview.srcObject = null;
      videoPreview.style.display = 'none';

      // Create preview
      const previewArea = document.getElementById('previewArea');
      const filePreview = document.getElementById('filePreview');
      const img = document.createElement('img');
      img.src = URL.createObjectURL(blob);
      img.style.maxWidth = '100%';

      // Add file info above preview
      const fileInfo = document.createElement('div');
      fileInfo.style.fontSize = '12px';
      fileInfo.style.color = '#666';
      fileInfo.style.marginBottom = '8px';
      fileInfo.innerHTML = `
        <strong>Captured Photo</strong><br>
        <strong>Camera:</strong> ${videoDevice}<br>
        <strong>Resolution:</strong> ${canvas.width}x${canvas.height}<br>
        <strong>Size:</strong> ${this.formatFileSize(blob.size)}
      `;

      previewArea.style.display = 'block';
      filePreview.innerHTML = '';
      filePreview.appendChild(img);
      filePreview.appendChild(fileInfo);

      // Create file for upload
      const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      document.getElementById('fileInput').files = dataTransfer.files;


      return blob;
    } catch (error) {
      console.error('Error capturing photo:', error);
      this.showToast('Error capturing photo');
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      return null;
    }
  },

  async startRecording(audioDeviceId = null) {
    try {
      // If already recording, stop it
      if (this.currentMediaRecorder && this.currentMediaRecorder.state === 'recording') {
        this.currentMediaRecorder.stop();
        document.getElementById('captureAudioBtn').innerHTML = '<i class="fas fa-microphone"></i>';
        document.getElementById('captureAudioBtn').style.backgroundColor = '#2ecc71';
        return;
      }

      const constraints = {
        audio: audioDeviceId ? { deviceId: { exact: audioDeviceId } } : true
      };

      const audioDevice = document.getElementById('audioDevices').selectedOptions[0].text;
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const mediaRecorder = new MediaRecorder(stream);
      const chunks = [];
      let startTime = Date.now();
      let timerInterval;

      mediaRecorder.ondataavailable = e => chunks.push(e.data);
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: this.audioRecordType });
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
        clearInterval(timerInterval);
        document.getElementById('recordingTime').textContent = '00:00';
        document.getElementById('stopRecordingBtn').style.display = 'none';
        document.getElementById('audioRecordingControls').style.display = 'none';
        document.getElementById('captureAudioBtn').innerHTML = '<i class="fas fa-microphone"></i>';
        document.getElementById('captureAudioBtn').style.backgroundColor = '#2ecc71';

        // Create preview with file info
        const fileInfo = document.createElement('div');
        fileInfo.style.fontSize = '12px';
        fileInfo.style.color = '#666';
        fileInfo.style.marginBottom = '8px';
        fileInfo.innerHTML = `
          <strong>Recorded Audio</strong><br>
          <strong>Microphone:</strong> ${audioDevice}<br>
          <strong>Duration:</strong> ${document.getElementById('recordingTime').textContent}<br>
          <strong>Size:</strong> ${this.formatFileSize(blob.size)}
        `;

        const audioPreview = document.createElement('audio');
        audioPreview.controls = true;
        audioPreview.src = URL.createObjectURL(blob);
        const previewArea = document.getElementById('previewArea');
        const filePreview = document.getElementById('filePreview');
        previewArea.style.display = 'block';
        filePreview.innerHTML = '';
        filePreview.appendChild(audioPreview);
        filePreview.appendChild(fileInfo);

        // Create file for upload
        const file = new File([blob], 'recording.' + this.audioRecordExt, { type: this.audioRecordType });
        document.getElementById('fileInput').files = new DataTransfer().files;
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        document.getElementById('fileInput').files = dataTransfer.files;
      };

      // Update recording time
      timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
        const seconds = (elapsed % 60).toString().padStart(2, '0');
        document.getElementById('recordingTime').textContent = `${minutes}:${seconds}`;
      }, 1000);

      mediaRecorder.start();
      document.getElementById('audioRecordingControls').style.display = 'flex';
      document.getElementById('stopRecordingBtn').style.display = 'block';
      document.getElementById('mediaPreview').style.display = 'block';
      document.getElementById('captureAudioBtn').innerHTML = '<i class="fas fa-stop"></i>';
      document.getElementById('captureAudioBtn').style.backgroundColor = '#e74c3c';

      return mediaRecorder;
    } catch (error) {
      console.error('Error starting recording:', error);
      this.showToast('Error accessing microphone');
      return null;
    }
  }

};
