import { promises } from "fs";
import { initRTPPacket, RTPPair, RTP_PAYLOAD_TYPE_H264, RTP_VERSION, SendRTPPacket, timeoutPromise } from "./rtp";
import { createSocket } from "dgram";


export const MAX_RTP_PAYLOAD = 1400;

export const startCode3 = new Uint8Array([0x00, 0x00, 0x01]);

export const startCode4 = new Uint8Array([0x00, 0x00, 0x00, 0x01]);

export const fps = 25;

async function main() {

    const CLIENT_PORT = 9832;
    const CLIENT_IP = '192.168.1.200';
    const BIND_PORT = 1234;

    const fullFile = await promises.readFile('./test.h264');
    const rtp = createSocket("udp4");
    await new Promise((resolve) => {
        rtp.bind(BIND_PORT, "0.0.0.0", () => resolve(null));
    });

    let nextBegin = 0;
    let frameList = new Array<Buffer>();
    while (true) {
        let index4 = fullFile.indexOf(startCode4, nextBegin);
        let index3 = fullFile.indexOf(startCode3, nextBegin);
        if ((index4 === -1) && (index3 === -1)) {
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
    while (true) {
        for (let frame of frameList) {
            const naluType = frame[0];
            if (frame.length > MAX_RTP_PAYLOAD) {
                //分包
                let [leftSize, sendSize] = [frame.length - 1, 1];
                let FUIndicator = (naluType & 0x60) | 28;
                // 分片打包,整包先去掉第一个字节,也就是 naluType
                while (leftSize > 0) {
                    let FUHeader = naluType & 0x1F;
                    if (leftSize == frame.length - 1) {
                        FUHeader |= 0x80;
                    } else if (leftSize <= MAX_RTP_PAYLOAD) {
                        FUHeader |= 0x40;
                    }
                    let currentSize = leftSize > MAX_RTP_PAYLOAD ? MAX_RTP_PAYLOAD : leftSize;
                    packet.payload = Buffer.concat([Buffer.from([FUIndicator, FUHeader]), frame.slice(sendSize, currentSize + sendSize)]);
                    const sendBytes = await SendRTPPacket(packet, rtp, CLIENT_PORT, CLIENT_IP);
                    console.log(`send frame fragment byte:${sendBytes}`);
                    leftSize -= currentSize;
                    sendSize += currentSize;
                    packet.header.seq++;
                }
            } else {
                //填充数据
                packet.payload = frame;
                const sendBytes = await SendRTPPacket(packet, rtp, CLIENT_PORT, CLIENT_IP);
                console.log(`send full frame byte:${sendBytes}`);
                packet.header.seq++;
            }
            if ((naluType & 0x1f) !== 7 && (naluType & 0x1f) !== 8) {
                packet.header.timestamp += 90000 / fps;
            }
            await timeoutPromise(1000 / fps);
        }
    }
};

export class RTP_H264 extends RTPPair {
    async startSend() {
        const fullFile = await promises.readFile(this.file);
        let nextBegin = 0;
        let frameList = new Array<Buffer>();
        while (true) {
            let index4 = fullFile.indexOf(startCode4, nextBegin);
            let index3 = fullFile.indexOf(startCode3, nextBegin);
            if ((index4 === -1) && (index3 === -1)) {
                break;
            } else if (index4 === -1) {
                // 开始码为 0 0 1
                if (nextBegin !== 0)
                    frameList.push(fullFile.slice(nextBegin, index3));
                nextBegin = index3 + 3;
            } else {// 开始码 0 0 1 和 0 0 0 1 都搜索到了
                if (index4 < index3) {//开始码 0 0 0 1
                    if (nextBegin !== 0)
                        frameList.push(fullFile.slice(nextBegin, index4));
                    nextBegin = index4 + 4;
                } else if (index4 > index3) {//开始码 0 0 1
                    if (nextBegin !== 0)
                        frameList.push(fullFile.slice(nextBegin, index3));
                    nextBegin = index3 + 3;
                } else {
                    throw new Error('0 0 0 1 === 0 0 1');
                }

            }
        }
        let packet = initRTPPacket(0, 0, 0, RTP_VERSION, RTP_PAYLOAD_TYPE_H264, 0, 0, 0, 0x88923423);
        for (let frame of frameList) {
            if (this.finished)
                break;
            const naluType = frame[0];
            if (frame.length > MAX_RTP_PAYLOAD) {
                //分包
                let [leftSize, sendSize] = [frame.length - 1, 1];
                let FUIndicator = (naluType & 0x60) | 28;
                // 分片打包,整包先去掉第一个字节,也就是 naluType
                while (leftSize > 0) {
                    let FUHeader = naluType & 0x1F;
                    if (leftSize == frame.length - 1) {
                        FUHeader |= 0x80;
                    } else if (leftSize <= MAX_RTP_PAYLOAD) {
                        FUHeader |= 0x40;
                    }
                    let currentSize = leftSize > MAX_RTP_PAYLOAD ? MAX_RTP_PAYLOAD : leftSize;
                    packet.payload = Buffer.concat([Buffer.from([FUIndicator, FUHeader]), frame.slice(sendSize, currentSize + sendSize)]);
                    const sendBytes = await SendRTPPacket(packet, this.rtp, this.clientRTPPort, this.clientHost);
                    console.log(`send frame fragment byte:${sendBytes}`);
                    leftSize -= currentSize;
                    sendSize += currentSize;
                    packet.header.seq++;
                }
            } else {
                //填充数据
                packet.payload = frame;
                const sendBytes = await SendRTPPacket(packet, this.rtp, this.clientRTPPort, this.clientHost);
                console.log(`send full frame byte:${sendBytes}`);
                packet.header.seq++;
            }
            // 如果 NALU 类型是 SEI/SPS/PPS/AUD,则不需要增加 rtp 头中的时间戳,也不需要等待
            if ((naluType & 0x1f) === 6 || //SEI
                (naluType & 0x1f) === 7 || //SPS
                (naluType & 0x1f) === 8 || //PPS
                (naluType & 0x1f) === 9)   //AUD
                continue;
            packet.header.timestamp += 90000 / this.fps;
            await timeoutPromise(1000 / this.fps);
        }
    }
};



// main();

