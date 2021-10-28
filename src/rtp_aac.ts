import { promises } from "fs";
import { initRTPPacket, RTPPair, RTP_VERSION, SendRTPPacket, timeoutPromise } from "./rtp";

const RTP_PAYLOAD_TYPE_AAC = 97;


function parseASDTSHeader(buffer: Buffer): ADTSHeader {

    return {} as ADTSHeader;
}

export interface ADTSHeader {
    syncWord: number;
    id: number;
    layer: number;
    protectionABsent: number;
    profile: number;
    sampleFreqIndex: number;
    privateBit: number;
    channelConfig: number;
    originalCopy: number;
    home: number;

    copyrightIdentificationBit: number;
    copyrightIdentificationStart: number;
    aacFrameLength: number;
    adtsBufferFullness: number;
    numberOfRawDataBlockInFrame: number;

};

export class RTP_H264 extends RTPPair {
    async startSend() {
        const fh = await promises.open(this.file, 0o666);
        let packet = initRTPPacket(0, 0, 0, RTP_VERSION, RTP_PAYLOAD_TYPE_AAC, 0, 0, 0, 0x88923423);
        while (true) {
            if (this.finished)
                break;
            const headerBuffer = Buffer.alloc(7);
            let { bytesRead } = await fh.read(headerBuffer, 0, 7);
            if (bytesRead !== 7)
                break;
            //throw new Error("can't read enough header");
            const header = parseASDTSHeader(headerBuffer);
            const AACDataLength = header.aacFrameLength - 7;
            const AACData = Buffer.alloc(AACDataLength);
            ({ bytesRead } = await fh.read(AACData, 0, AACDataLength));
            if (bytesRead !== AACDataLength)
                throw new Error("can't read enough data");
            //0xffe0 = 1 1111 1110 0000 0x1f = 11111
            const fistFour = Buffer.from([0x00, 0x10, (0xffe0 & AACDataLength) >> 5, (0x1f & AACDataLength) << 3]);
            packet.payload = Buffer.concat([fistFour, AACData]);
            await SendRTPPacket(packet, this.rtp, this.clientRTPPort, this.clientHost);
            await timeoutPromise(1000 / this.fps);
            await timeoutPromise(23);
        }
    }
};
