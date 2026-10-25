// WebSocket client for the TV's control channel (ws://<ip>:<port>).
// Port of bridge/tv-client.js: RFC 6455, binary protobuf frames out,
// JSON ResultBody text frames in, auto-reconnect with backoff. This mirrors
// the original app's WebClient (e/i/b/e/g/h.java).

package com.wisdomshare.remote

import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import okio.ByteString
import android.os.Handler
import android.os.Looper
import java.util.concurrent.TimeUnit

class TvClient {
    interface Listener {
        fun onOpen()
        fun onClosed(willReconnect: Boolean)
        fun onFailure(e: Throwable)
        fun onTvResponse(body: String) // JSON ResultBody text frame from the TV
    }

    var listener: Listener? = null

    private val client = OkHttpClient.Builder()
        .connectTimeout(5, TimeUnit.SECONDS)
        .build()

    private var webSocket: WebSocket? = null
    private var ip: String? = null
    private var port: Int = 0
    @Volatile private var wantConnected = false
    private var attempts = 0
    private val handler = Handler(Looper.getMainLooper())

    val isConnected: Boolean get() = webSocket != null
    val address: String get() = "$ip:$port"

    fun connect(ip: String, port: Int) {
        this.ip = ip
        this.port = port
        closeSocket()
        val request = Request.Builder().url("ws://$ip:$port").build()
        webSocket = client.newWebSocket(request, socketListener)
    }

    fun send(frame: ByteArray) {
        val ws = webSocket ?: throw IllegalStateException("not connected to TV")
        ws.send(ByteString.of(*frame))
    }

    fun sendKey(code: Int) = send(Proto.keyEvent(code))
    fun sendText(text: String) = send(Proto.keyboardInput(text))

    fun disconnect() {
        wantConnected = false
        handler.removeCallbacksAndMessages(null)
        closeSocket()
    }

    private fun closeSocket() {
        try { webSocket?.cancel() } catch (_: Exception) {}
        webSocket = null
    }

    private fun handleDown() {
        webSocket = null
        val retry = wantConnected
        listener?.onClosed(retry)
        if (retry) scheduleReconnect()
    }

    private fun scheduleReconnect() {
        if (!wantConnected) return
        val delay = minOf(15000L, 1000L * (1 shl minOf(attempts, 4)))
        attempts += 1
        val i = ip ?: return
        val p = port
        handler.postDelayed({ connect(i, p) }, delay)
    }

    private val socketListener = object : WebSocketListener() {
        override fun onOpen(ws: WebSocket, response: Response) {
            attempts = 0
            listener?.onOpen()
        }

        override fun onMessage(ws: WebSocket, text: String) {
            // The TV answers with JSON ResultBody text frames (verified in the
            // original client's onMessage).
            listener?.onTvResponse(text)
        }

        override fun onMessage(ws: WebSocket, bytes: ByteString) {
            // Binary responses are not parsed by the original client either.
        }

        override fun onClosed(ws: WebSocket, code: Int, reason: String) = handleDown()

        override fun onFailure(ws: WebSocket, t: Throwable, response: Response?) {
            listener?.onFailure(t)
            handleDown()
        }
    }
}