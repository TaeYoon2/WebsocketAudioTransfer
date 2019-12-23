/**
 * An audio spectrum visualizer built with HTML5 Audio API
 * Author:Wayou
 * License: MIT
 * Feb 15, 2014
 */
window.onload = function() {
    
    	window.Recorder = Recorder;// var Recorder
      
      var visualizer = new Visualizer().ini();
      console.log("ini()");
};
// window.onload 끝



//Worker 경로
var WORKER_PATH = 'recorderWorker.js';

//recorderWorker.js 를 사용한 녹음기 함수
var Recorder = function(source, cfg){
    var config = cfg || {};
    var bufferLen = config.bufferLen || 4096;
    this.context = source.context;
    this.node = this.context.createScriptProcessor(bufferLen, 1, 1);
    var worker = new Worker(config.workerPath || WORKER_PATH);
    worker.postMessage({
      command: 'init',
      config: {
        sampleRate: this.context.sampleRate
      }
    });
    var recording = false,
      currCallback;

    this.node.onaudioprocess = function(e){
      if (!recording) return;
	//console.log("in : " + new Date().toISOString());
      worker.postMessage({
        command: 'record',
        buffer: [
          e.inputBuffer.getChannelData(0)
        ]
      });
	this._test_func();
    }

    this.configure = function(cfg){
      for (var prop in cfg){
        if (cfg.hasOwnProperty(prop)){
          config[prop] = cfg[prop];
        }
      }
    }

    this.record = function(){
      recording = true;
    }

    this.stop = function(){
      recording = false;
    }

    this.clear = function(){
      worker.postMessage({ command: 'clear' });
    }

	this.allclear = function(){
      worker.postMessage({ command: 'allclear' });
    }

    this.getBuffer = function(cb) {
      currCallback = cb || config.callback;
      worker.postMessage({ command: 'getBuffer' })
    }

	this.getFullbuffer = function(cb) {
		currCallback = cb || config.callback;
      worker.postMessage({ command: 'getFullbuffer' })
    }

	this.getFullLength = function() {
		worker.postMessage({ command: 'getFullLength' })
	}

    this.exportWAV = function(cb, type){
      currCallback = cb || config.callback;
      type = type || config.type || 'audio/wav';
      if (!currCallback) throw new Error('Callback not set');
      worker.postMessage({
        command: 'exportWAV',
        type: type
      });
    }

    this.exportRAW = function(cb, type){
      currCallback = cb || config.callback;
      type = type || config.type || 'audio/raw';
      if (!currCallback) throw new Error('Callback not set');
      worker.postMessage({
        command: 'exportRAW',
        type: type
      });
    }

    this.export16kMono = function(cb, type){
      currCallback = cb || config.callback;
      type = type || config.type || 'audio/raw';
      if (!currCallback) throw new Error('Callback not set');
      worker.postMessage({
        command: 'export16kMono',
        type: type
      });
    }

    // FIXME: doesn't work yet
    this.exportSpeex = function(cb, type){
      currCallback = cb || config.callback;
      type = type || config.type || 'audio/speex';
      if (!currCallback) throw new Error('Callback not set');
      worker.postMessage({
        command: 'exportSpeex',
        type: type
      });
    }

    worker.onmessage = function(e){
      var blob = e.data;
      currCallback(blob);
    }

    source.connect(this.node);
    this.node.connect(this.context.destination);    //TODO: this should not be necessary (try to remove it)
  };
  
  Recorder.forceDownload = function(blob, filename){
	    var url = (window.URL || window.webkitURL).createObjectURL(blob);
	    var link = window.document.createElement('a');
	    link.href = url;
	    link.download = filename || 'output.wav';
	    var click = document.createEvent("Event");
	    click.initEvent("click", true, true);
	    link.dispatchEvent(click);
	  }
 //// 녹음기 Recorder() 끝

var Visualizer = function() {
    this.audioContext = null;
//    this.source = null; //the audio source
//    this.info = document.getElementById('info').innerHTML; //used to upgrade the UI information
//    this.infoUpdateId = null; //to store the setTimeout ID and clear the interval
    this.mSocket = null;
    this.mRecorder = null;
    this.animationId = null;
    this.status = 0; //flag for sound is playing 1 or stopped 0
    this.forceStop = false;
    this.allCapsReachBottom = false;
    
    this.output = null;
    this.statusOutput = null;
    this.resultOutput = null;
    
    this.sampleRate = 0;
};
Visualizer.prototype = {
    ini: function() {
        this._prepareAPI();
        this._addEventListner();
    },
    // 객체 초기 설정 (화면출력과 오디오 설정) onLoad 대신
    _prepareAPI: function() {
    	
    	this.output = document.getElementById("output");
       this.statusOutput = document.getElementById("statusOutput");
    	this.resultOutput = document.getElementById("resultOutput");
    	this._writeToScreenStatus("DISCONNECTED");
    	this._writeToScreen('<span style="color: blue;">결과 출력</span>');
    	
        //fix browser vender for AudioContext and requestAnimationFrame
    	window.AudioContext = window.AudioContext || window.webkitAudioContext || window.mozAudioContext || window.msAudioContext;
        window.requestAnimationFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.msRequestAnimationFrame;
        window.cancelAnimationFrame = window.cancelAnimationFrame || window.webkitCancelAnimationFrame || window.mozCancelAnimationFrame || window.msCancelAnimationFrame;
//        try {
//            this.audioContext = new AudioContext();
//        } catch (e) {
//            this._updateInfo('!Your browser does not support AudioContext', false);
//            console.log(e);
//        }
        
        try {
    	    this.audioContext = new AudioContext();
    	    console.log("audioContext()");
    	    navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
    	    window.URL = window.URL || window.webkitURL;
    	    //mContext = new AudioContext();
        } catch (e) {
            throw 'WebAudio API has no support on this browser.';
            console.log( 'WebAudio API has no support on this browser.');
    	this._writeToScreenStatus("no support on this browser" + e.data);
        }

    	this.sampleRate = this.audioContext.sampleRate;
    	console.log("SampleRate: ",this.sampleRate);

    	if (navigator.getUserMedia) {
    	    var audioSourceConstraints = {
    		audio: {optional: [{echoCancellation:false}]},
    		video: false
    	    };
    		navigator.getUserMedia(audioSourceConstraints, this._startUserMedia, function(e) {
    			config.onError(ERR_CLIENT, "No live audio input in this browser: " + e.data);
    			this._writeToScreenStatus("No live audio input in this browser: " + e.data);
    		});
    	}
    	else
    		console.log("start fail, getUserMedia");
    },
    
//  녹음 버튼 토글
    _toggleRecording :  function ( e ) {
        if (e.classList.contains("recording")) {
            // stop recording
            //e.classList.remove("recording");
    	this._on_stop();
        } else {
            // start recording
            //e.classList.add("recording");
    	this._on_record();
        }
    },
//////////////           socket 기능                   /////////////////    
//    녹음 시작
    _on_record : function() {

    	if(this.audioContext.state === 'suspended') {
//    		writeToScreenStatus("AudioContext resume");
    		this.audioContext.resume();
    	}

    	var temp = document.getElementById("record");
    	
    	if(!(temp.classList.contains("recording"))) {
    		temp.classList.add("recording");

    	this.mRecorder.allclear();
    	this._on_clear();
    	this.mRecorder.record();

    	var wsUri = "wss://" + location.hostname + ':' + location.port + '/ws';
    	this.mSocket = new WebSocket(wsUri);
    	this.mSocket.binaryType = 'arraybuffer';
    	this.mSocket.onopen = function(evt) { this._on_open(evt) };
    	this.mSocket.onclose = function(evt) { this._on_close(evt) };
    	this.mSocket.onmessage = function(evt) { this._on_message(evt) };
    	this.mSocket.onerror = function(evt) { this._on_error(evt) };

    	}
    },
  //소켓 오픈
    _on_open : function(evt)
    {
    	if (this.mSocket.readyState == 0) {
    		console.log("on_open : websocket - connection has not been established");
    		this._writeToScreenStatus("on_open : websocket - connection has not been established");
    	}
    	else if (this.mSocket.readyState == 1) {
    		this._writeToScreenStatus("CONNECTED");
            console.log("record start");
    		this.mSocket.send("{\"language\":\"ko\",\"intermediates\":true,\"cmd\":\"join\"}");
    /*		intervalKey = setInterval(function() {
    			mRecorder.export16kMono(function(blob) {
    				socketSend(blob);
    				mRecorder.clear();
    			}, 'audio/x-raw');
    		}, 125);
    */	//mRecorder.record();
    		//button_record.setAttribute('disabled', 'disabled');
    		//button_stop.removeAttribute('disabled');
    	}
    	else if (this.mSocket.readyState == 2) {
    		console.log("on_open : websocket - connection is going through the closing handshake");
    		this._writeToScreenStatus("on_open : websocket - connection is going through the closing handshake");
    	}
    	else if (this.mSocket.readyState == 3) {
    		console.log("on_open : websocket - connection has been closed or could not be opend");
    		this._writeToScreenStatus("on_open : websocket - connection has been closed or could not be opend");
    	}
    	else
    		this._writeToScreenStatus("on_open : i don't know");
    },
    
 // 소켓 close
    _on_close : function(evt)
    {
//    	writeToScreenStatus("DISCONNECTED");
    	on_stop();
    	if (event.code == 1000)
                reason = "Normal closure, meaning that the purpose for which the connection was established has been fulfilled.";
            else if(event.code == 1001)
                reason = "An endpoint is \"going away\", such as a server going down or a browser having navigated away from a page.";
            else if(event.code == 1002)
                reason = "An endpoint is terminating the connection due to a protocol error";
            else if(event.code == 1003)
                reason = "An endpoint is terminating the connection because it has received a type of data it cannot accept (e.g., an endpoint that understands only text data MAY send this if it receives a binary message).";
            else if(event.code == 1004)
                reason = "Reserved. The specific meaning might be defined in the future.";
            else if(event.code == 1005)
                //reason = "No status code was actually present.";
                reason = "DISCONNECTED";
            else if(event.code == 1006)
               reason = "The connection was closed abnormally, e.g., without sending or receiving a Close control frame";
            else if(event.code == 1007)
                reason = "An endpoint is terminating the connection because it has received data within a message that was not consistent with the type of the message (e.g., non-UTF-8 [http://tools.ietf.org/html/rfc3629] data within a text message).";
            else if(event.code == 1008)
                reason = "An endpoint is terminating the connection because it has received a message that \"violates its policy\". This reason is given either if there is no other sutible reason, or if there is a need to hide specific details about the policy.";
            else if(event.code == 1009)
               reason = "An endpoint is terminating the connection because it has received a message that is too big for it to process.";
            else if(event.code == 1010) // Note that this status code is not used by the server, because it can fail the WebSocket handshake instead.
                reason = "An endpoint (client) is terminating the connection because it has expected the server to negotiate one or more extension, but the server didn't return them in the response message of the WebSocket handshake. <br /> Specifically, the extensions that are needed are: " + event.reason;
            else if(event.code == 1011)
                reason = "A server is terminating the connection because it encountered an unexpected condition that prevented it from fulfilling the request.";
            else if(event.code == 1015)
                reason = "The connection was closed due to a failure to perform a TLS handshake (e.g., the server certificate can't be verified).";
            else
                reason = "Unknown reason";
    	this._writeToScreenStatus(reason);
    	this.mRecorder.getFullbuffer(_gotBuffers);
    },
// 소켓 메시지
    _on_message : function(evt)
    {
//    	writeToScreen('<span style="color: blue;">' + evt.data+'</span>');
            var reciveMessage = JSON.parse(evt.data);
//          writeToScreen('<span style="color: blue;">' + reciveMessage.topic +'</span>');
            var payload = JSON.stringify(reciveMessage.payload);
            var textMessage = JSON.parse(payload);

            if (reciveMessage.event == "close") {
    		if(textMessage.status)
    	 		this._writeToScreenResult('<span style="color: blue;">' + textMessage.status +'</span>');
                    on_stop();
    		//toggleRecording(document.getElementById("record"));
            }
            else if (textMessage.text) {
    		this._writeToScreenResult('<span style="color: blue;">' + textMessage.text +'</span>');
                    //writeToScreen('<span style="color: blue;">' + textMessage.text +'</span>');
            }

    /*
    	writeToScreen('<span style="color: blue;">' + evt.data+'</span>');

        var reciveMessage = JSON.parse(evt.data)
    	writeToScreen('<span style="color: blue;">' + reciveMessage.topic +'</span>');
        if (reciveMessage.event == "phx_close") {
    		on_stop();
    	}
    */
    },

    // 소켓 에러
    _on_error : function(evt)
    {
    	this._writeToScreenStatus('<span style="color: red;">ERROR:</span> ' + evt.data);
    },
    
    
// 스크린에 메시지
    _writeToScreenStatus: function(message)
    {
    	var pre = document.createElement("p");
        pre.style.wordWrap = "break-word";
        pre.innerHTML = message;
        //statusOutput.appendChild(pre);
        this.statusOutput.innerHTML=message;
    },
    
    _writeToScreen : function(message)
    {
    	var pre = document.createElement("p");
        pre.style.wordWrap = "break-word";
        pre.innerHTML = message;
        //resultOutput.appendChild(pre);
        this.resultOutput.innerHTML=message;
    },
    
// 녹음 종료
    _on_stop : function() {
    	var temp = document.getElementById("record");
    	if(temp.classList.contains("recording")) {
    		temp.classList.remove("recording");
    	this.mRecorder.stop();
    	clearInterval(intervalKey);

    	if (this.mSocket != null) {
    		this.mRecorder.export16kMono(function(blob) {
    			this._socketSend(blob);
    			//socketSend(TAG_END_OF_SENTENCE);
    		}, 'audio/x-raw');
    		this.mSocket.close();
    		this.mSocket = null;
    		console.log("record stop");

    	}
    	else{
    		console.log("mSocket is null");
    	}

    	//createDownloadLink();
    	}
    },
//////////////           socket 기능                   /////////////////        
 // 소켓 통신
    
    _socketSend : function (item) {
    	if (this.mSocket) {
    		var state = this.mSocket.readyState;
    		if (state == 1) {
    			// If item is an audio blob
    			if (item instanceof Blob) {
    				if (item.size > 0) {
    					this.mSocket.send(item);
    					//mRecorder.getFullbuffer(gotBuffers);
    					this.mRecorder.getBuffer(_gotBuffers);
    					//config.onEvent(MSG_SEND, 'Send: blob: ' + item.type + ', ' + item.size);
    				} else {
    					//config.onEvent(MSG_SEND_EMPTY, 'Send: blob: ' + item.type + ', EMPTY');
    				}
    			// Otherwise it's the EOS tag (string)
    			} else {
    				this.mSocket.send(item);
    				//config.onEvent(MSG_SEND_EOS, 'Send tag: ' + item);
    			}
    		} else {
    			//config.onError(ERR_NETWORK, 'WebSocket: readyState!=1: ' + state + ": failed to send: " + item);
    		}
    	} else {
    		//config.onError(ERR_CLIENT, 'No web socket connection: failed to send: ' + item);
    	}
    },
    

// 화면 clear
    _on_clear : function() {
    	this._writeToScreen("");
    	this._writeToScreenStatus("");
    	this._writeToScreenResult("");
    },
    
    //test
    _test_func : function() {
    	mRecorder.export16kMono(function(blob) {
//    		mRecorder.getFullbuffer(gotBuffers);
    		socketSend(blob);
    		mRecorder.clear();
    	}, 'audio/x-raw');
    },
    
   

    // 오디오 컨택스트에서 analyser 로 analyser에서 데스티네이션으로
    // 녹음기 생성
    _startUserMedia : function(stream) {
    	mAudioInput = this.audioContext.createMediaStreamSource(stream);
        //Firefox loses the audio input stream every five seconds To fix added the input to window.source
        window.source = mAudioInput;

    	// make the analyser available in window context
//    	window.userSpeechAnalyser = mContext.createAnalyser();
    	var analyser = this.audioContext.createAnalyser();
    	
    	analyser.fftSize = 256; // see - there is that 'fft' thing. 
        var source = this.audioContext.createMediaElementSource(player); // this is where we hook up the <audio> element
        source.connect(analyser);
        analyser.connect(this.audioContext.destination);
        var sampleAudioStream = function() {
            // This closure is where the magic happens. Because it gets called with setInterval below, it continuously samples the audio data
            // and updates the streamData and volume properties. This the SoundCouldAudioSource function can be passed to a visualization routine and 
            // continue to give real-time data on the audio stream.
            analyser.getByteFrequencyData(self.streamData);
            // calculate an overall volume value
            var total = 0;
            for (var i = 0; i < 80; i++) { // get the volume from the first 80 bins, else it gets too loud with treble
                total += self.streamData[i];
            }
            self.volume = total;
        };
        setInterval(sampleAudioStream, 20); // 
        // public properties and methods
        this.volume = 0;
        this.streamData = new Uint8Array(128); // This just means we will have 128 "bins" (always half the analyzer.fftsize value), each containing a number between 0 and 255. 
        this.playStream = function(streamUrl) {
            // get the input stream from the audio element
            player.setAttribute('src', streamUrl);
            player.play();
        }
        window.userSpeechAnalyser = analyser;
    	var osc = mContext.createOscillator();
//        osc.frequency.value = 440;
//        osc.type = 'square';
        
        oscGain = mContext.createGain();
        oscGain.gain.value = 0.2;

//        osc.start(mContext.currentTime);
//        osc.stop(mContext.currentTime + 3);

//        osc.connect(oscGain);   
        oscGain.connect(window.userSpeechAnalyser); /*Connect oscillator to analyser node*/
    	
    	mAudioInput.connect(window.userSpeechAnalyser);
    	window.userSpeechAnalyser.fftSize = 2048;
    	bufferLength = window.userSpeechAnalyser.frequencyBinCount; 
    	dataArray = new Uint8Array(bufferLength);
        this.mRecorder = new Recorder(mAudioInput, { workerPath : './lib/recorderWorker.js' });
    },
    
    
    
    _addEventListner: function() {
        var that = this,
            audioInput = document.getElementById('uploadedFile');
//            dropContainer = document.getElementsByTagName("canvas")[0];
        //listen the file upload
        audioInput.onchange = function() {
            if (that.audioContext===null) {return;};

            //the if statement fixes the file selction cancle, because the onchange will trigger even the file selection been canceled
            if (audioInput.files.length !== 0) {
                //only process the first file
                that.file = audioInput.files[0];
                that.fileName = that.file.name;
                if (that.status === 1) {
                    //the sound is still playing but we upload another file, so set the forceStop flag to true
                    that.forceStop = true;
                };
                document.getElementById('fileWrapper').style.opacity = 1;
                that._updateInfo('Uploading', true);
                //once the file is ready,start the visualizer
                that._start();
            };
        };
        
        
//        //listen the drag & drop
//        dropContainer.addEventListener("dragenter", function() {
//            document.getElementById('fileWrapper').style.opacity = 1;
//            that._updateInfo('Drop it on the page', true);
//        }, false);
//        dropContainer.addEventListener("dragover", function(e) {
//            e.stopPropagation();
//            e.preventDefault();
//            //set the drop mode
//            e.dataTransfer.dropEffect = 'copy';
//        }, false);
//        dropContainer.addEventListener("dragleave", function() {
//            document.getElementById('fileWrapper').style.opacity = 0.2;
//            that._updateInfo(that.info, false);
//        }, false);
//        dropContainer.addEventListener("drop", function(e) {
//            e.stopPropagation();
//            e.preventDefault();
//            if (that.audioContext===null) {return;};
//            document.getElementById('fileWrapper').style.opacity = 1;
//            that._updateInfo('Uploading', true);
//            //get the dropped file
//            that.file = e.dataTransfer.files[0];
//            if (that.status === 1) {
//                document.getElementById('fileWrapper').style.opacity = 1;
//                that.forceStop = true;
//            };
//            that.fileName = that.file.name;
//            //once the file is ready,start the visualizer
//            that._start();
//        }, false);
    },
    
    
//    _start: function() {
//        //read and decode the file into audio array buffer
//        var that = this,
//            file = this.file,
//            fr = new FileReader();
//        fr.onload = function(e) {
//            var fileResult = e.target.result;
//            var audioContext = that.audioContext;
//            if (audioContext === null) {
//                return;
//            };
//            that._updateInfo('Decoding the audio', true);
//            audioContext.decodeAudioData(fileResult, function(buffer) {
//                that._updateInfo('Decode succussfully,start the visualizer', true);
//                that._visualize(audioContext, buffer);
//            }, function(e) {
//                that._updateInfo('!Fail to decode the file', false);
//                console.error(e);
//            });
//        };
//        fr.onerror = function(e) {
//            that._updateInfo('!Fail to read the file', false);
//            console.error(e);
//        };
//        //assign the file to the reader
//        this._updateInfo('Starting read the file', true);
//        fr.readAsArrayBuffer(file);
//    },
    _gotBuffers : function( buffers ) {

    this._visualize();
    },
    _visualize: function() {
       
        //connect the source to the analyser
        
        //connect the analyser to the destination(the speaker), or we won't hear the sound
        
        //then assign the buffer to the buffer source node
        
        //play the source
        
        //stop the previous sound if any
        if (this.animationId !== null) {
            cancelAnimationFrame(this.animationId);
        }
//        if (this.source !== null) {
//            this.source.stop(0);
//        }
//        
        this.status = 1;
        
       
        this._drawSpectrum(window.userSpeechAnalyser);
    },
    _drawSpectrum: function(analyser) {
        var that = this,
            canvas = document.getElementById('wavedisplay'),
            cwidth = canvas.width,
            cheight = canvas.height - 2,
            meterWidth = 10, //width of the meters in the spectrum
            gap = 2, //gap between meters
            capHeight = 2,
            capStyle = '#fff',
            meterNum = 800 / (10 + 2), //count of the meters
            capYPositionArray = []; ////store the vertical position of hte caps for the preivous frame
        ctx = canvas.getContext('2d'),
        gradient = ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(1, '#0f0');
        gradient.addColorStop(0.5, '#ff0');
        gradient.addColorStop(0, '#f00');
        var drawMeter = function() {
            var array = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(array);
            if (that.status === 0) {
                //fix when some sounds end the value still not back to zero
                for (var i = array.length - 1; i >= 0; i--) {
                    array[i] = 0;
                };
                allCapsReachBottom = true;
                for (var i = capYPositionArray.length - 1; i >= 0; i--) {
                    allCapsReachBottom = allCapsReachBottom && (capYPositionArray[i] === 0);
                };
                if (allCapsReachBottom) {
                    cancelAnimationFrame(that.animationId); //since the sound is stoped and animation finished, stop the requestAnimation to prevent potential memory leak,THIS IS VERY IMPORTANT!
                    return;
                };
            };
            var step = Math.round(array.length / meterNum); //sample limited data from the total array
            ctx.clearRect(0, 0, cwidth, cheight);
            for (var i = 0; i < meterNum; i++) {
                var value = array[i * step];
                if (capYPositionArray.length < Math.round(meterNum)) {
                    capYPositionArray.push(value);
                };
                ctx.fillStyle = capStyle;
                //draw the cap, with transition effect
                if (value < capYPositionArray[i]) {
                    ctx.fillRect(i * 12, cheight - (--capYPositionArray[i]), meterWidth, capHeight);
                } else {
                    ctx.fillRect(i * 12, cheight - value, meterWidth, capHeight);
                    capYPositionArray[i] = value;
                };
                ctx.fillStyle = gradient; //set the filllStyle to gradient for a better look
                ctx.fillRect(i * 12 /*meterWidth+gap*/ , cheight - value + capHeight, meterWidth, cheight); //the meter
            }
            that.animationId = requestAnimationFrame(drawMeter);
        }
        this.animationId = requestAnimationFrame(drawMeter);
    },
    _audioEnd: function(instance) {
        if (this.forceStop) {
            this.forceStop = false;
            this.status = 1;
            return;
        };
        this.status = 0;
        var text = 'HTML5 Audio API showcase | An Audio Viusalizer';
        document.getElementById('fileWrapper').style.opacity = 1;
        document.getElementById('info').innerHTML = text;
        instance.info = text;
        document.getElementById('uploadedFile').value = '';
    },
    _updateInfo: function(text, processing) {
        var infoBar = document.getElementById('info'),
            dots = '...',
            i = 0,
            that = this;
        infoBar.innerHTML = text + dots.substring(0, i++);
        if (this.infoUpdateId !== null) {
            clearTimeout(this.infoUpdateId);
        };
        if (processing) {
            //animate dots at the end of the info text
            var animateDot = function() {
                if (i > 3) {
                    i = 0
                };
                infoBar.innerHTML = text + dots.substring(0, i++);
                that.infoUpdateId = setTimeout(animateDot, 250);
            }
            this.infoUpdateId = setTimeout(animateDot, 250);
        };
    }
}
