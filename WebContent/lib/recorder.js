var mSocket = null;
var output = null;
var statusOutput = null;
var resultOutput = null;
var mContext;
var mAudioInput;

var mResampler;
var mRecorder;
var canvas;
var sampleRate = 0;
var bufferLength;
var dataArray;
var WIDTH = 300;
var HEIGHT = 300;

function startUserMedia(stream) {
    mAudioInput = mContext.createMediaStreamSource(stream);
    // Firefox loses the audio input stream every five seconds To fix added the
    // input to window.source
    window.source = mAudioInput;
    // make the analyser available in window context
    window.userSpeechAnalyser = mContext.createAnalyser();


    mAudioInput.connect(window.userSpeechAnalyser);
    window.userSpeechAnalyser.fftSize = 2048;
    bufferLength = window.userSpeechAnalyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);
    mRecorder = new Recorder(mAudioInput, { workerPath : './lib/recorderWorker.js' });
    status = 1;
}
function makeAudioContext() {
    return new Promise(function (resolve, reject){
        try {
            window.AudioContext = window.AudioContext || window.webkitAudioContext;
            mContext = new AudioContext();
            window.URL = window.URL || window.webkitURL;
            resolve();

        } catch (e) {
            throw 'WebAudio API has no support on this browser.';
            console.log( 'WebAudio API has no support on this browser.');
            writeToScreenStatus("no support on this browser" + e.data);
        }

    });
}
function getDevices() {
        if(navigator.mediaDevices){
            /** * source Constratints ** */
            var audioSourceConstraints = {
                audio: {optional: [{echoCancellation:false}]},
                video: false
            };
            return navigator.mediaDevices.getUserMedia(audioSourceConstraints);

        } else console.log("No Devices");
}

function onLoad()
{
    output = document.getElementById("output");
    statusOutput = document.getElementById("statusOutput");
    resultOutput = document.getElementById("resultOutput");
    confidence = document.getElementById("confidence");

    makeAudioContext().then(getDevices).then(startUserMedia);
    writeToScreenStatus("Ready");
    writeToScreen('<span style="color:#bbbbbb;">결과 출력</span>');
}
function on_open(evt)
{
    if (mSocket.readyState == 0) {
        console.log("on_open : websocket - connection has not been established");
        writeToScreenStatus("on_open : websocket - connection has not been established");
    }
    else if (mSocket.readyState == 1) {
        writeToScreenStatus("Decoding");
        console.log("record start");
        mSocket.send("{\"language\":\"ko\",\"intermediates\":true,\"cmd\":\"join\"}");
    }
    else if (mSocket.readyState == 2) {
        console.log("on_open : websocket - connection is going through the closing handshake");
        writeToScreenStatus("on_open : websocket - connection is going through the closing handshake");
    }
    else if (mSocket.readyState == 3) {
        console.log("on_open : websocket - connection has been closed or could not be opend");
        writeToScreenStatus("on_open : websocket - connection has been closed or could not be opend");
    }
    else writeToScreenStatus("on_open : i don't know");
}

function socketSend(item) {
    if (mSocket) {
        // 소켓이 열려있으면
        var state = mSocket.readyState;
        if (state == 1) {
            // If item is an audio blob
                if (item instanceof Blob) {
                        if (item.size > 0) {
                        	    // send 16k mono wav to server
                                mSocket.send(item);
                                // plot wav
                                mRecorder.getBuffer(gotBuffers);
                        }
                } else {
                    //BLOB 이 아니면 어쨋든 보내
                    mSocket.send(item);
                }
            } else {
                //상태가 1이 아니면 아무것도 안해
            }
        } else {
    		//소켓이 닫혀있으면 아무것도 안해
    	}
}
function on_close(evt)
{
    forcestop= true;
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
    /*********Special Here ***********/
    else if(event.code == 1005)
        // reason = "No status code was actually present.";
        reason = "Ready";
    /*********Special Here ***********/
    else if(event.code == 1006)
        reason = "The connection was closed abnormally, e.g., without sending or receiving a Close control frame";
    else if(event.code == 1007)
        reason = "An endpoint is terminating the connection because it has received data within a message that was not consistent with the type of the message (e.g., non-UTF-8 [http://tools.ietf.org/html/rfc3629] data within a text message).";
    else if(event.code == 1008)
        reason = "An endpoint is terminating the connection because it has received a message that \"violates its policy\". This reason is given either if there is no other sutible reason, or if there is a need to hide specific details about the policy.";
    else if(event.code == 1009)
        reason = "An endpoint is terminating the connection because it has received a message that is too big for it to process.";
    else if(event.code == 1010) // Note that this status code is not used by the
        						// server, because it can fail the WebSocket
    							// handshake instead.
    reason = "An endpoint (client) is terminating the connection because it has expected the server to negotiate one or more extension, but the server didn't return them in the response message of the WebSocket handshake. <br /> Specifically, the extensions that are needed are: " + event.reason;
    else if(event.code == 1011)
        reason = "A server is terminating the connection because it encountered an unexpected condition that prevented it from fulfilling the request.";
    else if(event.code == 1015)
        reason = "The connection was closed due to a failure to perform a TLS handshake (e.g., the server certificate can't be verified).";
    else
        reason = "Unknown reason";
    writeToScreenStatus(reason);
    mRecorder.getFullbuffer(gotBuffers);
}
function on_message(evt){


    var reciveMessage = JSON.parse(evt.data);

    var payload = JSON.stringify(reciveMessage.payload);
    var textMessage = JSON.parse(payload);
    if (reciveMessage.event == "close") {
        //클로즈 이벤트
        if(textMessage.status)
        writeToScreenResult('<span  class="scroll" style="color: blue;">' + textMessage.status +'</span>');
        on_stop();

    }
    else if (textMessage.text) {
        writeToScreenResult('<div style="margin:0 10%;height:24pt;text-align:center;color:#bbbbbb;">' + textMessage.text +'</div>');
        writeToScreenConfidence('<div style="text-align:center;color:#bbbbbb;font-size:80%;">' + (textMessage.confidence*100).toPrecision(4)+'%' +'</div>');
    }

}
function on_error(evt)
{
    writeToScreenStatus('<span style="color: red;">ERROR:</span> ' + evt.data);
}
function writeToScreenStatus(message)
{
    var pre = document.createElement("p");
    pre.style.wordWrap = "break-word";
    pre.innerHTML = message;
    statusOutput.innerHTML=message;
}
function writeToScreenResult(message)
{
    resultOutput.innerHTML=message;
}
function writeToScreenConfidence(message)
{
    confidence.innerHTML=message;
}
function writeToScreen(message)
{
    var pre = document.createElement("p");
    pre.style.wordWrap = "break-word";
    pre.innerHTML = message;

    resultOutput.innerHTML=message;
}
function toggleRecording(e) {
    if (e.classList.contains("recording")) {
        forcestop= true;
        on_stop();
    } else {
        forcestop= false;
        on_record();
    }
}
function on_record() {
	blobbies= [];
	if(status!=1){
		status=1;
	}

	function keepgoing() {
		if(mContext.state === 'suspended') {
			console.log('state ==> resume')
			mContext.resume();
		}
		var btn = document.getElementById("record");
		if(!(btn.classList.contains("recording"))) {
			btn.classList.add("recording");
			mRecorder.allclear();
			on_clear();
			mRecorder.record();

			var wsUri = "wss://" + "39.118.204.91" + '/ws';
			mSocket = new WebSocket(wsUri);
			mSocket.binaryType = 'arraybuffer';
			mSocket.onopen = function(evt) { on_open(evt) };
			mSocket.onclose = function(evt) { on_close(evt) };
			mSocket.onmessage = function(evt) { on_message(evt) };
			mSocket.onerror = function(evt) { on_error(evt) };
		}
	} // keepgoing
	window.setTimeout(keepgoing,300);
}

function on_stop() {
	//소켓이 닫히는 유일한 곳
	var btn = document.getElementById("record");
	if(btn.classList.contains("recording")) {
		// 녹음중이면
		btn.classList.remove("recording");
		mRecorder.stop();
		if (mSocket != null) {
			// 녹음중이고 소켓이 열려있으면
			mRecorder.export16kMono(function(blob) {
				socketSend(blob);
			}, 'audio/x-raw');
			mSocket.close();
			mSocket = null;

			console.log("record stop");
			}
		else{
			console.log("mSocket is null");
		}

		status=0;
	}
}
function on_clear() {
   writeToScreen("");
   writeToScreenStatus("");
   writeToScreenResult("");
}

function gotBuffers( buffers ) {
    var canvas = document.getElementById( "wavedisplay" );

    drawSpectrum(canvas, window.userSpeechAnalyser);
}
function drawSpectrum(canvas, analyser) {

    cwidth = canvas.width,
    cheight = canvas.height - 2,
    meterWidth = 20, // width of the meters in the spectrum
    gap = 4, // gap between meters
    capHeight = 2,
    capStyle = '#fff',
    meterNum = 1100 / (20 + 4 ), // count of the meters
    capYPositionArray = []; // //store the vertical position of hte caps for the
							// preivous frame
    ctx = canvas.getContext('2d'),
    gradient = ctx.createLinearGradient(0, 270, 0, 300);
    gradient.addColorStop(0, '#aaaaaa');  // yellow
    gradient.addColorStop(1, '#ffffff');   // white


    var drawMeter = function() {
    	var array = new Uint8Array(window.userSpeechAnalyser.frequencyBinCount);
    	window.userSpeechAnalyser.getByteFrequencyData(array);
    	// **************** status 가 0이면 array를 모두 0으로 하고,
    	if (status === 0) {
    		// that.status -> var status
    		// that deprecated but.. how to controll status
    		// fix when some sounds end the value still not back to zero
    		for (var i = array.length - 1; i >= 0; i--) {
    			array[i] = 0;
    		};
    		/** 만약 이게 다 없으면 * */
    		// **************** 모든 주파수가 0이 되면 에니메이션 프레임을 종료
    		allCapsReachBottom = true;
    		for (var i = capYPositionArray.length - 1; i >= 0; i--) {
    			allCapsReachBottom = allCapsReachBottom && (capYPositionArray[i] === 0);
    		};
    		if (allCapsReachBottom) {
    			cancelAnimationFrame(animationId); // since the sound is stoped
													// and animation finished,
													// stop the requestAnimation
													// to prevent potential
													// memory leak,THIS IS VERY
													// IMPORTANT!
    			// that -> Visualizer() deprecated but animationId needed
    			return;
    		};
    		// **************** 모든 주파수가 0이 되면 에니메이션 프레임을 종료
    		/** 만약 이게 다 없으면 * */
    	};
    	if(forcestop==true){
    		ctx.clearRect(0, 0, cwidth, cheight);
			cancelAnimationFrame(animationId);
			return;
		}
    	var step = Math.round(array.length / meterNum); // sample limited data from the total array
    	ctx.clearRect(0, 0, cwidth, cheight);
    	for (var i = 0; i < meterNum; i++) {
    			var value = array[i * step];
    			if (capYPositionArray.length < Math.round(meterNum)) {
    				capYPositionArray.push(value);
    			};
    			ctx.fillStyle = capStyle;
    			// draw the cap, with transition effect
    			if (value < capYPositionArray[i]) {
    				ctx.fillRect(i * 24, cheight - (--capYPositionArray[i]), meterWidth, capHeight);
    			} else {
    				ctx.fillRect(i * 24, cheight - value, meterWidth, capHeight);
    				capYPositionArray[i] = value;
    			};
    			// set the filllStyle to gradient for a better look
    			ctx.fillStyle = gradient;
    			// the meter
    			ctx.fillRect(i * 24 /* meterWidth+gap */ , cheight - value + capHeight, meterWidth, cheight);
    	}// canvas drawing roop

    	animationId = requestAnimationFrame(drawMeter);
    	// requestAnimation
    }// drawMeter
    animationId = requestAnimationFrame(drawMeter);
    // requestAnimation
	}// drawSpectrum


/** ************ 실행부 ************** */

(function(window){
	var status = 0;
	var forcestop = false;
	var animationId = null;
	var WORKER_PATH = 'recorderWorker.js';

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
			// buffer 마다 바로 리샘플 후 서버 전송
			this.export16kMonoSync(function(blob){
				socketSend(blob);
				this.clear();
	        }, 'audio/x-raw', e.inputBuffer.getChannelData(0))

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
		this.export16kMonoSync = function(cb, type, data){
			currCallback = cb || config.callback;
			type = type || config.type || 'audio/raw';
			if (!currCallback) throw new Error('Callback not set');
			worker.postMessage({
				command: 'export16kMonoSync',
				type: type,
				buffer: [data]
            })
		}
		// FIXME: doesn't work yet
		this.exportSpeex = function(cb, type){
			currCallback = cb || config.callback;
			type = type || config.type || 'audio/speex';
			if (!currCallback) throw new Error('Callback not set');
			worker.postMessage({
				command: 'exportSpeex',
				type: type});
		}
		worker.onmessage = function(e){
			var blob = e.data;
			currCallback(blob);
		}
		source.connect(this.node);

		// TODO: this should not be necessary (try to remove it)
		this.node.connect(this.context.destination);
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
	window.Recorder = Recorder;
})(window);
