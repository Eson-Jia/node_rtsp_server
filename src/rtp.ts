import { createSocket, RemoteInfo, Socket } from "dgram";
import { promisify } from "util";

export const timeoutPromise = promisify(setTimeout);

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


export async function SendRTPPacket(packet: RTPPacket, socket: Socket, client_port: number, client_ip: string) {
    const Header = Buffer.alloc(11);
    //set header
    return new Promise((resolve, reject) => {
        socket.send(Buffer.concat([Header, packet.payload]), client_port, client_ip, (err, bytes) => {
            if (err)
                reject(err);
            resolve(bytes);
        });
    });
}