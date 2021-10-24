import {promises} from "fs";
import {initRTPPacket, RTP_PAYLOAD_TYPE_H264, RTP_VERSION, SendRTPPacket, timeoutPromise} from "./rtp";
import {createSocket} from "dgram";


const MAX_RTP_PAYLOAD = 1400;

const startCode3 = new Uint8Array([0x00, 0x00, 0x01]);

const startCode4 = new Uint8Array([0x00, 0x00, 0x00, 0x01]);

async function main() {
    const fullFile = await promises.readFile('./test.h264');
    const rtp = createSocket("udp4");
    rtp.bind(1234, "0.0.0.0");
    await new Promise((resolve) => {
        rtp.bind(1234, "0.0.0.0", () => {
            resolve();
        });
    });
    const fps = 25;
    let nextBegin = 0;
    let frameList = new Array<Buffer>();
    while (true) {
        let index4 = fullFile.indexOf(startCode4, nextBegin);
        let index3 = fullFile.indexOf(startCode3, nextBegin);
        if ((index4 === -1) && (index3 === -1)) {
            console.log('last frame');
            break;
        } else if (index4 === -1) {
            // 开始码为 0 0 1
            if (nextBegin !== 0)
                frameList.push(fullFile.slice(nextBegin, index3));
            nextBegin = index3 + 3;
        } else {
            // 开始码为 0 0 0 1
            if (nextBegin !== 0)
                frameList.push(fullFile.slice(nextBegin, index4));
            nextBegin = index4 + 4;
        }
    }
    let packet = initRTPPacket(0, 0, 0, RTP_VERSION, RTP_PAYLOAD_TYPE_H264, 0, 0, 0, 0x88923423);
    for (const frame of frameList) {
        const nalType = frame[0];
        if (frame.length > MAX_RTP_PAYLOAD) {//分包
            let leftBuffer = frame.length;
            let FUIndicator = (nalType & 0x60) | 28;
            let FUHeader = nalType & 0x1f;
            while (leftBuffer > 0) {
                if (leftBuffer == frame.length) {
                    FUHeader |= 0x80;
                } else if (leftBuffer < MAX_RTP_PAYLOAD) {
                    FUHeader |= 0x40;
                }
                let currentSize = leftBuffer > MAX_RTP_PAYLOAD ? MAX_RTP_PAYLOAD : leftBuffer;
                packet.payload = Buffer.concat([Buffer.from([FUIndicator, FUHeader]), frame.slice(0, currentSize)]);
                leftBuffer -= currentSize;
                packet.header.seq++;
            }
        } else {
            //填充数据
            packet.payload = frame;
        }
        await SendRTPPacket(packet, 123 as any, 8554, '192..168.1.7');
        if ((nalType & 0x1f) !== 7 && (nalType & 0x1f) !== 8) {
            packet.header.timestamp += 90000 / fps;
        }
        await timeoutPromise(1000 / fps);
    }
};

main();

