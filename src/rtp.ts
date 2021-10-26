import { createSocket, Socket } from "dgram";
import { promises } from "fs";
import { promisify } from "util";
import { MAX_RTP_PAYLOAD, startCode3, startCode4 } from "./h264";

export const timeoutPromise = promisify(setTimeout);

export const RTP_VERSION = 2;
export const RTP_PAYLOAD_TYPE_H264 = 96;

export interface RTPHeader {

    // byte 0 注意从上到下 bit 位逐渐升高. version 在最高的 2bit
    csrcCount: any, //4b
    extention: any,//1b
    padding: any,//1b
    version: any,//2b

    // byte 1
    payloadType: any, //7b
    marker: any,// 1b

    // bytes 2-3
    seq: any, //16b

    // bytes 4-7
    timestamp: any,

    //bytes 8-11
    ssrc: any,
};

export interface RTPPacket {
    header: RTPHeader,
    payload: Buffer,
};

export function initRTPPacket(
    csrcCount: any,
    extention: any,
    padding: any,
    version: any,
    payloadType: any,
    marker: any,
    seq: any,
    timestamp: any,
    ssrc: any,
): RTPPacket {
    return {
        header: {
            csrcCount,
            extention,
            padding,
            version,
            payloadType,
            marker,
            seq,
            timestamp,
            ssrc,
        },
        payload: null as any,
    };
}


export async function SendRTPPacket(packet: RTPPacket, socket: Socket, client_port: number, client_ip: string) {
    const {
        header: {
            csrcCount, //4b
            extention,//1b
            padding,//1b
            version,//2b

            // byte 1
            payloadType, //7b
            marker,// 1b

            // bytes 2-3
            seq, //16b

            // bytes 4-7
            timestamp,

            //bytes 8-11
            ssrc,
        }
    } = packet;
    const Header = Buffer.alloc(12);
    Header.writeUInt8(csrcCount | extention << 4 | padding << 5 | version << 6, 0);
    Header.writeUInt8(marker << 7 | payloadType, 1);
    Header.writeUInt16BE(seq, 2);
    Header.writeUInt32BE(timestamp, 4);
    Header.writeUInt32BE(ssrc, 8);
    //set header
    return new Promise((resolve, reject) => {
        socket.send(Buffer.concat([Header, packet.payload]), client_port, client_ip, (err, bytes) => {
            if (err)
                reject(err);
            resolve(bytes);
        });
    });
}

export async function socketBind(socket: Socket): Promise<number> {
    return await new Promise((resolve) => {
        socket.bind(() => {
            const { port } = socket.address();
            resolve(port);
        });
    });
}

export async function socketClose(socket: Socket): Promise<null> {
    return await new Promise((resolve) => {
        socket.close(() => {
            resolve(null);
        });
    });
}

export class RTPPair {
    constructor(readonly file: string, readonly clientHost: string, readonly clientRTPPort: number, readonly clientRTCPPort: number) {
        [this.rtp, this.rtcp] = [createSocket('udp4'), createSocket('udp4')];
        this.rtpBindPort = -1;
        this.rtcpBindPort = -1;
        this.finished = false;
        this.fps = 25;
    }
    fps: number;
    rtp: Socket;
    rtcp: Socket;
    rtpBindPort: number;
    rtcpBindPort: number;
    finished: boolean;
    async bind(): Promise<[number, number]> {
        [this.rtpBindPort, this.rtcpBindPort] = await Promise.all([
            socketBind(this.rtp),
            socketBind(this.rtcp),
        ]);
        return [this.rtpBindPort, this.rtcpBindPort];
    }
    stopSend() {
        this.finished = true;
    }

    async shutdown() {
        this.finished = true;
        await Promise.all([
            socketClose(this.rtp),
            socketClose(this.rtcp),
        ]);
    }

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
            } else {
                // 开始码为 0 0 0 1
                if (nextBegin !== 0)
                    frameList.push(fullFile.slice(nextBegin, index4));
                nextBegin = index4 + 4;
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
            if ((naluType & 0x1f) !== 7 && (naluType & 0x1f) !== 8) {
                packet.header.timestamp += 90000 / this.fps;
            }
            await timeoutPromise(1000 / this.fps);
        }
    }
};