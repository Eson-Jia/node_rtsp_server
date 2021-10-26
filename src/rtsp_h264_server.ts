import { createServer, Socket, Server } from "net";
import { getReq, Session, splitter } from "./rtsp";

export class RTSPServer {
    constructor(readonly port: number, readonly host: string) {
        this.server = createServer(this.connection);
    }
    listen() {
        this.server.listen(this.port, '0.0.0.0', () => console.log('server llisten on ', this.port));
    }
    server: Server;
    private connection(socket: Socket) {
        let data = '';
        if (!socket.remoteAddress)
            throw new Error('socket remote address is empty');
        let session: Session = {
            clientHost: socket.remoteAddress,
            serverHost: socket.localAddress,
        };
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
    }

};

function run() {
    const server = new RTSPServer(8554, '192.168.1.72');
    server.listen();
}

run();
