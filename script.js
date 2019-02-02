const sharedAudioContext = new AudioContext();

const audioURL = 'teste.mp3';

var FFTResults = [];
var chunks; //per second

var SHEIGHT = 1024;
var SWIDTH = 10000;

var s = document.getElementById("spectrogram");
var spect = s.getContext("2d");

var samplesPerSec = 23;

var endBuffer;

var offSampleRate = 14400; //sample rate for offlineaudiocontext

var SCPBufferSize = 4096; //buffer size for script processor

var repeatedSection;

const audioDidLoad = ( buffer ) =>
{
  console.log("audio decoded");
  var samplesCount = 0;
  const context = new OfflineAudioContext(1, (buffer.length/3), offSampleRate);
  const source = context.createBufferSource();
  const processor = context.createScriptProcessor(SCPBufferSize, 1, 1);

  const analyser = context.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.25;
  
  source.buffer = buffer;

  source.connect(analyser);
  analyser.connect(processor);
  processor.connect(context.destination); // this is necessary for the script processor to start

  var freqData = new Uint8Array(analyser.frequencyBinCount);

  var num = 1;
  processor.onaudioprocess = () =>
  {
    analyser.getByteFrequencyData(freqData);

    addLine(freqData);
    createBinArray(freqData, num);
    num++;
    //FFTResults.push(freqData);
    samplesCount++;
  };

  source.start(0);
  context.startRendering();
  
  context.oncomplete = (e) => {
    //document.getElementById('result').innerHTML = 'Read ' + samplesCount + ' samples';

    console.log(FFTResults);
    console.log(partitionData(FFTResults));

    chunks = partitionData(FFTResults);

    //IMPORTANT
    //var finalScoredChunks = scoreChunks(FFTResults, true);

    //console.log(finalScoredChunks)

    //drawSpect();

    simpleScore(FFTResults);

    var testClips = []

    for (i = 0; i < 4; i++) {
        var start = Math.floor(i * (buffer.length / 4));
        var end = Math.floor((i+1) * (buffer.length / 4));
        testClips.push(new clip(start, end));
    };

    [testClips[1], testClips[2]] = [testClips[2], testClips[1]];

    console.log(testClips);

    var testBuffer = LoCToBuffer(buffer, testClips);

    playBuffer(LoCToBuffer(buffer, repeatedSection), sharedAudioContext);

    source.disconnect( analyser );
    processor.disconnect( context.destination );
  };
};

var request = new XMLHttpRequest();
request.open('GET', audioURL, true);
request.responseType = 'arraybuffer';

request.onload = () => {
  var audioData = request.response;
  sharedAudioContext.decodeAudioData(
    audioData,
    audioDidLoad,
    e => { console.log("Error with decoding audio data" + e.err); }
  );
};
request.send();

var lineX = 0;

function addLine (data) {

    var boxW = 1;
    var boxH = 1;

    for (i = 0; i < data.length; i++) {
        spect.beginPath();
        spect.rect(lineX, (SHEIGHT - i*boxH), boxW, boxH);

        logIndex = logScale(i, data.length);
        spect.fillStyle = getGrayColor(data[logIndex]);
        //spect.fillStyle = getGrayColor(getRandomInt(0, 200));
        spect.fill();
    }

    spect.beginPath();
    spect.rect(lineX, 20, 1, 10);
    spect.fillStyle = 'rgb(0, 0, 0)';
    spect.fill();

    lineX += boxW;
}

function createBinArray (data, i) {

    var dataList = []; //bin

    for (i = 0; i < data.length; i++) {
        dataList.push(data[i])
    }

    var chunk = new sChunk([], dataList, i);

    FFTResults.push(chunk);
}

//partitionData: ListofBins

function partitionData (data) {

    var results = [];

    var numSamples = data.length/samplesPerSec
    
    for (i = 0; i < numSamples; i++) {

        var perSecond = []; //subset of samples

        for (j = 0; j < samplesPerSec; j++) {
            try {
                perSecond.push(data[j*i])
            } catch (e) {
                
            }
        }

        results.push(perSecond);
    }

    return results;

}

function logScale (index, total, opt_base) {
    var base = opt_base || 2;
    var logmax = logBase(total + 1, base);
    var exp = logmax * index / total;
    return Math.round(Math.pow(base, exp) - 1);
}

function logBase (val, base) {
    return Math.log(val) / Math.log(base);
}

function drawSpect() {

    var boxW = 1;
    var boxH = 1;

    //ARRAY MANIPULATION
    var simpleResults = []; //in order to not have a very wide image collect every 3rd bin
    var skipVal = 1; //interval at which to take array values from

    var delta = Math.floor(FFTResults.length / skipVal);

    for (i = 0; i < (FFTResults.length / skipVal); i+=skipVal) {
        simpleResults.push(FFTResults[i]);
    }

    console.log(simpleResults);

    //IMAGE CREATION
    spect.fillStyle = 'rgb(200, 200, 200)';

    spect.lineWidth = 2;
    spect.strokeStyle = 'rgb(0, 0, 0)';

    spect.fillStyle = 'rbg(0, 0, 0)'
    spect.fill();

    try {

        spect.clearRect(0, 0, SWIDTH, SHEIGHT);

        spect.beginPath();
        spect.rect(10, 10, 10, 10);
        spect.fillStyle = 'rgb(0, 0, 0)';
        spect.fill();

        spect.beginPath();
        spect.arc(100, 75, 50, 0, 2 * Math.PI);
        spect.stroke();

        for (i = 0; i < simpleResults.length; i++) {
            for (j = 0; j < simpleResults[i].length; j++) {
                spect.beginPath();
                spect.rect(i*boxW, j*boxH, boxW, boxH);
                spect.fillStyle = getGrayColor(simpleResults[i][j]);
                //spect.fillStyle = getGrayColor(getRandomInt(0, 200));
                spect.fill();
            }
        }

    } catch (error) {
            console.log(error)
    }
}

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getGrayColor (value) {
    return 'rgb(V, V, V)'.replace(/V/g, 255 - value);
}

function sChunk (scores, data, index) { //Chunks that have a score
    this.scores = scores;
    this.FFTData = data;
    this.index = index; //time location, used to infer 
}

function chunkScoreTracker (score, index) {
    this.score = score;
    this.index = index;
}

function clip (beginning, end) {
    this.start = beginning;
    this.end = end;
    this.length = end - beginning;
}

function scoreChunks (chunkArray, removeZero) {

    var scoredChunkArray = chunkArray;

    for (i = 0; i < chunkArray.length; i++) {

        if (removeZero) {
            if((/[^0]/).exec(chunkArray[i].FFTData.join(""))){
                for (j = 0; j < chunkArray.length; j++) {
                    if (j != i) {
                        scoredChunkArray[i].scores.push(new chunkScoreTracker(SSD(chunkArray[i], chunkArray[j]), chunkArray[j].index));
                    }
                }
            }
        } else {
            for (j = 0; j < chunkArray.length; j++) {
                if (j != i) {
                    scoredChunkArray[i].scores.push(new chunkScoreTracker(SSD(chunkArray[i], chunkArray[j]), chunkArray[j].index));
                }
            }
        }
    }

    return scoredChunkArray;

}

function simpleScore (chunks) {
    var aIndex;
    var chunkA

    var offset = secsToSampleIndex(5);
    console.log(offset);
    var RMSChunks = chunks.slice(offset, Math.floor(chunks.length / 2));
    var RMSVals = [];

    console.log(RMSChunks)

    for (n = 0; n < RMSChunks.length; n++) {
        RMSVals.push(RMS(RMSChunks[n].FFTData));
    }

    console.log(RMSVals)

    var minIndex = 0;
    var min = RMSVals[0];

    for (e = 1; e < RMSVals.length; e++) {
        if (RMSVals[e] < min) {
            minIndex = e;
            min = RMSVals[e];
        }
    }

    aIndex = minIndex + offset; //location of beginning chunk
    chunkA = chunks[aIndex];

    console.log(chunkA);

    //FINDING THE NEXT CHUNK
    //ALSO: for some reason i is a variable set to 1024 so dont use that

    var afterA = chunks.slice(aIndex) // resulting array after alpha index
    var chunkB;

    console.log(afterA);

    for (whyisInowork = 1; whyisInowork < afterA.length; whyisInowork++) {
        chunkA.scores.push(new chunkScoreTracker(SSD(chunkA.FFTData, afterA[whyisInowork].FFTData), whyisInowork + aIndex));
        //console.log(whyisInowork);
    }

    addWeight(chunkA.scores, 100, 0.5);

    console.log(chunkA.scores);

    bIndex = (minIndexST(chunkA.scores) + (aIndex + 1));
    chunkB = chunks[bIndex];

    console.log("hey thx");
    console.log(bIndex);
    console.log(chunkA);
    console.log(chunkB);

    var beginning = chunks.slice(0, aIndex);
    var end = chunks.slice(bIndex);

    repeatedSection = [new clip(0, sampleToBufferIndex(aIndex)), new clip(sampleToBufferIndex(aIndex), sampleToBufferIndex(bIndex)), new clip(sampleToBufferIndex(aIndex), sampleToBufferIndex(bIndex)), new clip(sampleToBufferIndex(aIndex), sampleToBufferIndex(bIndex)), new clip(bIndex, chunks.length - 1)];

    console.log(end);

}

function SSD (bin1, bin2) {
    ssd = 0;

    for (i = 0; i < bin1.length; i++) {
        diff = bin1[i] - bin2[i];
        ssd += diff*diff
    }

    return ssd;
}

function RMS (array) {

    //square
    var newArray = [];

    for (i = 0; i < array.length; i++) {
        newArray.push(array[i]*array[i]);
    }

    //mean/sum

    var sum = 0;
    for (i = 0; i < newArray.length; i++) {
        sum += newArray[i];
    }
    var mean = sum/newArray.length;

    //root

    return Math.sqrt(mean);
}

function getTime (index) {
    return index*samplesPerSec;
}

function LoCToBuffer (buffer, clips) {

    var endBuffer = sharedAudioContext.createBuffer(buffer.numberOfChannels, buffer.duration*buffer.sampleRate, buffer.sampleRate);

    for (i = 0; i < buffer.numberOfChannels; i++) {
        var dataChan = buffer.getChannelData(i);
        var newDataChan = endBuffer.getChannelData(i);
        //console.log(dataChan)

        // for (j = 0; j < dataChan.length; j++) {
        //     newDataChan[j] = dataChan[j + 3000000]
        // }

        var location = 0;

        for (l = 0; l < clips.length; l++) {

            for (n = 0; n < (clips[l].end - clips[l].start); n++) {
                newDataChan[location + n] = dataChan[n + clips[l].start];
            }

            location += clips[l].length
        }
    }

    return endBuffer;

}

function playBuffer (buffer, ctx) {
    var source = ctx.createBufferSource();
    source.buffer = buffer;

    source.connect(ctx.destination);
    source.start();
}

function minIndexST (arr) {
    var index = 0;
    var min = arr[0].score;

    for (nice = 0; nice < arr.length; nice++) {
        if (arr[nice].score < min) {
            index = nice;
            min = arr[nice].score;
        }
    }

    return index;
}

function addWeight (scores, length, steepness) { //score array, how long is the score down thing
    position = 0;

    for (q = length; q > 0; q--) {
        scores[position].score = clampMin(scores[position].score*(q*steepness), scores[position].score);
        position++;
    }
    return scores;
}

// var testWeights = [];
// console.log("thing:");
// for (e = 0; e < 500; e++) {
//     testWeights.push(new chunkScoreTracker(10000));
// }

// addWeight(testWeights, 100, 0.5)

// console.log(testWeights);

function sampleToBufferIndex (n) {
    return Math.round(n*SCPBufferSize);
}

function secsToBufferIndex (n) {

}

function secsToSampleIndex (n) {
    return Math.round((n*offSampleRate) / SCPBufferSize)
}

function clampMin (num, min) {
    if (num < min) {
        return min
    } else {
        return num
    }
}

function playBufferTest () {
    playBuffer(LoCToBuffer(buffer, repeatedSection), sharedAudioContext);
}