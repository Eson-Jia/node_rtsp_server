import { Socket } from "dgram";
import { promisify } from "util";

export const timeoutPromise = promisify(setTimeout);

export const RTP_VERSION = 2;
export const RTP_PAYLOAD_TYPE_H264 = 96;

export interface RTPHeader {

    // byte 0
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
    Header.writeUInt16LE(seq, 2);
    Header.writeUInt32LE(timestamp, 4);
    Header.writeUInt32LE(ssrc, 8);
    //set header
    return new Promise((resolve, reject) => {
        socket.send(Buffer.concat([Header, packet.payload]), client_port, client_ip, (err, bytes) => {
            if (err)
                reject(err);
            resolve(bytes);
        });
    });
}