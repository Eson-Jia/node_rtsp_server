# node_rtsp_server

最简陋的 rtsp server 实现,[参考](https://blog.csdn.net/weixin_42462202/category_9293806.html).

## 学习[从零开始写一个RTSP服务器（三）RTP传输H.264](https://blog.csdn.net/weixin_42462202/article/details/99089020)

### 主机字节序和网络字节序

字节序的粒度是**字节**,每个字节中的`bit`的位置是不变的.

参考:

- [理解字节序](https://www.ruanyifeng.com/blog/2016/11/byte-order.html)

### rtp over udp_multicast

采用 rtsp over udp multicast 播放监控相机的视频

1. 在相机配置页面开启`多播`并设置正确的`多播地址`例如: 239.255.255.254
2. 使用`ffplay -rtsp_transport udp_multicast rtsp://相机流地址`

`tcpdump`抓包[如下](https://github.com/Eson-Jia/blog/issues/2#issuecomment-954571830)
