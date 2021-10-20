import { createSocket } from "dgram";
import { createServer } from "net";

const splitter = '\r\n\r\n';
const line_splitter = '\r\n';

function listen() {
    console.info('listen');
}

type CB = (response: string) => void;

function getReq(session: any, req: string, cb: CB) {
    console.debug(`get req:${req}`);
    handle(session, req, cb);
}

function getLine(req: string): [string, string] {
    let pos = req.indexOf(line_splitter);
    if (pos === -1) {
        return [req, ''];
    }
    return [req.substring(0, pos + line_splitter.length), req.substr(pos + line_splitter.length)];
}

function getMethod(params: string): string | null {
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

function getPort(content: string): [number, number] {
    const result = /(\d+)-(\d+)/.exec(content);
    if (!result || result.length < 3) {
        throw new Error("can not parse rtp");

    }
    return [parseInt(result[1]), parseInt(result[2])];
}

function handle(session: any, req: string, cb: CB) {
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
            const [rtp, rtcp] = getPort(left);
            session = Object.assign(session, { client_rtp: rtp, client_rtcp: rtcp });
            handleSetup(session, CSeq, cb);
            break;
        case 'PLAY':
            handlePlay(session, CSeq, cb);
            break;
        case null:
            throw new Error(`null method`);
        default:
            throw new Error(`unkown method:${method}`);
    }
}

function handleOptions(session: any, CSeq: string, cb: CB) {
    const response =
        `RTSP/1.0 200 OK\r
CSeq: ${CSeq}\r
Public: OPTIONS, DESCRIBE, SETUP, PLAY\r\n\r\n`;
    cb(response);
}

function handleDescribe(session: any, CSeq: string, cb: CB) {
    const sdp =
        `v=0\r
o=- 91565340853 1 IN IP4 ${session.host}\r
t=0 0\r
a=control:*\r
m=video 0 RTP/AVP 96\r
a=rtpmap:96 H264/900000\r
a=control:rtsp://192.168.1.72:8554/test/track0`;
    const response =
        `RTSP/1.0 200 OK\r
CSeq: ${CSeq}\r
Content-Type: application/sdp\r
Content-Length: ${sdp.length}\r\n\r\n${sdp}`;
    cb(response);
}


function handleSetup(session: any, CSeq: string, cb: CB) {
    const { client_rtp, client_rtcp, server_rtp, server_rtcp } = session;
    const response =
        `RTSP/1.0 200 OK\r
CSeq: ${CSeq}\r
Transport: RTP/AVP;unicast;client_port=${client_rtp}-${client_rtcp};server_port=${server_rtp}-${server_rtcp}\r
Session: 66334873\r\n\r\n`;
    cb(response);
}
function handlePlay(session: any, CSeq: string, cb: CB) {
    const response =
        `RTSP/1.0 200 OK\r
CSeq: ${CSeq}\r
Range: npt=0.000-\r
Session: 66334873; timeout=60\r\n\r\n`;
    cb(response);
}

function main() {
    const server = createServer((socket) => {
        const [rtp, rtcp] = [createSocket('udp4'), createSocket('udp4')];
        const [server_rtp, server_rtcp] = [12345, 12346];
        rtp.bind(server_rtp);
        rtp.on('message', (msg) => {
            console.log(msg);
        });
        rtcp.bind(server_rtcp);
        rtcp.on('message', (msg) => {
            console.log(msg);
        });
        let host = '192.168.1.72';
        let session = { server_rtcp, server_rtp, host };
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
                // console.log(data);
            }
        });
    });
    server.listen(8554, '0.0.0.0', listen);
}

main();