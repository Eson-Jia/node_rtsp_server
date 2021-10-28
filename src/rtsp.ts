import { createSocket } from "dgram";
import { createServer } from "net";
import { RTPPair } from "./rtp";
import { fps, RTP_H264 } from "./rtp_h264";

export const splitter = '\r\n\r\n';
export const line_splitter = '\r\n';

export type CB = (response: string) => void;

export function getReq(session: Session, req: string, cb: CB) {
    console.debug(`get req:${req}`);
    handle(session, req, cb);
}

export function getLine(req: string): [string, string] {
    let pos = req.indexOf(line_splitter);
    if (pos === -1) {
        return [req, ''];
    }
    return [req.substring(0, pos + line_splitter.length), req.substr(pos + line_splitter.length)];
}

export function getMethod(params: string): string | null {
    const result = /(.*) .* .*/.exec(params);
    if (!result) {
        return null;
    }
    return result[1];
}

function getCSeq(params: string): string | null {
    const result = /CSeq\: (\d+)/.exec(params);
    if (!result) {
        return null;
    }
    return result[1];
}

export function getPort(content: string): [number, number] {
    const result = /(\d+)-(\d+)/.exec(content);
    if (!result || result.length < 3) {
        throw new Error("can not parse rtp");

    }
    return [parseInt(result[1]), parseInt(result[2])];
}

export function handle(session: Session, req: string, cb: CB) {
    let [first, left] = getLine(req);
    const method = getMethod(first);
    const CSeq = getCSeq(left);
    if (!CSeq) {
        throw new Error(`CSeq unknown`);
    }
    switch (method) {
        case 'OPTIONS':
            handleOptions(session, CSeq, cb);
            break;
        case 'DESCRIBE':
            handleDescribe(session, CSeq, cb);
            break;
        case 'SETUP':
            [session.clientRTPPort, session.clientRTCPPort] = getPort(left);
            handleSetup(session, CSeq, cb);
            break;
        case 'PLAY':
            handlePlay(session, CSeq, cb);
            break;
        case 'TEARDOWN':
            handleTearDown(session, CSeq, cb);
            break;
        case null:
            throw new Error(`null method`);
        default:
            throw new Error(`unkown method:${method}`);
    }
}

export function handleOptions(session: Session, CSeq: string, cb: CB) {
    const response =
        `RTSP/1.0 200 OK\r
CSeq: ${CSeq}\r
Public: OPTIONS, DESCRIBE, SETUP, PLAY\r\n\r\n`;
    cb(response);
}

export function handleDescribe(session: Session, CSeq: string, cb: CB) {
    const sdp =
        `v=0\r
o=- 91565340853 1 IN IP4 ${session.serverHost}\r
t=0 0\r
a=control:*\r
m=video 0 RTP/AVP 96\r
a=rtpmap:96 H264/90000\r
a=control:rtsp://192.168.1.72:8554/test/track0`;
    const response =
        `RTSP/1.0 200 OK\r
CSeq: ${CSeq}\r
Content-Type: application/sdp\r
Content-Length: ${sdp.length}\r\n\r\n${sdp}`;
    cb(response);
}


export async function handleSetup(session: Session, CSeq: string, cb: CB) {
    const { clientRTPPort, clientRTCPPort, clientHost } = session;
    const pair = new RTP_H264('./test.h264', clientHost, clientRTPPort as number, clientRTCPPort as number, fps);
    const [serverRTPPort, serverRTCPPort] = await pair.bind();
    session.pair = pair;
    const response =
        `RTSP/1.0 200 OK\r
CSeq: ${CSeq}\r
Transport: RTP/AVP;unicast;client_port=${clientRTPPort}-${clientRTCPPort};server_port=${serverRTPPort}-${serverRTCPPort}\r
Session: 66334873\r\n\r\n`;
    cb(response);
}

export async function handlePlay(session: Session, CSeq: string, cb: CB) {
    session.pair?.startSend();
    const response =
        `RTSP/1.0 200 OK\r
CSeq: ${CSeq}\r
Range: npt=0.000-\r
Session: 66334873; timeout=60\r\n\r\n`;
    cb(response);
}

export async function handleTearDown(session: Session, CSeq: string, cb: CB) {
    session.pair?.shutdown();
    const response =
        `RTSP/1.0 200 OK\r
CSeq: ${CSeq}\r\n\r\n`;
    cb(response);
}

export interface Session {
    serverHost: string,
    clientHost: string,
    clientRTPPort?: number,
    clientRTCPPort?: number,
    pair?: RTPPair,
};

function main() {
    const server = createServer((socket) => {
        const [rtp, rtcp] = [createSocket('udp4'), createSocket('udp4')];
        const [server_rtp, server_rtcp] = [12345, 12346];
        rtp.bind(server_rtp);
        rtp.on('message', (msg) => {
            console.debug('rtp: ', msg);
        });
        rtcp.bind(server_rtcp);
        rtcp.on('message', (msg) => {
            console.debug('rtcp: ', msg);
        });
        let host = '192.168.1.72';
        if (!socket.remoteAddress)
            throw new Error('remote address is null');
        let session = {
            serverHost: host,
            clientHost: socket.remoteAddress,
        };
        let data = '';
        socket.on('data', (buffer) => {
            data += buffer;
            let end = data.indexOf(splitter);
            if (end != -1) {

                const cb = (response: string) => {
                    console.log(`response:${response}`);
                    socket.write(response);
                };
                getReq(session, data.substring(0, end + splitter.length), cb);
                data = data.substr(end + splitter.length);
            }
        });
    });
    server.listen(8554, '0.0.0.0', () => console.log('server llisten on 8554'));
}

// 已经不可以用了
// main();
