import { createSocket, RemoteInfo, Socket } from "dgram";

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


export function SendRTPPacket(packet: RTPPacket, socket: Socket, client_port: number, client_ip: string) {
    let buffer = Buffer.alloc(1500);
}



const client_ip = '192.168.1.200';
const client_port = 9832;

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