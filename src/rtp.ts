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
    const Header = Buffer.from([1, 2, 3, 4, 5]);
    return new Promise((resolve, reject) => {
        socket.send(Buffer.concat([Header, packet.payload]), client_port, client_ip, (err, bytes) => {
            if (err)
                reject(err);
            resolve(bytes);
        });
    });
}

function main() {
    const rtp = createSocket('udp4');
    rtp.bind(12345, '0.0.0.0');
    rtp.on('message', (msg: Buffer, rinfo: RemoteInfo) => {
        console.debug('from ', rinfo, 'got a message', msg);
    });
    setInterval(() => {
        // rtp.send('adfadf', client_port, client_ip);
        rtp.send(Buffer.alloc(1));
    }, 100);
}

main();