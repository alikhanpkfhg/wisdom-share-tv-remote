// The remote screen. Discovery → connect → protobuf key events over the TV's
// WebSocket. Experimental keys are labelled with "~" in the layout.

package com.wisdomshare.remote

import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.app.Activity
import android.view.HapticFeedbackConstants
import android.view.MotionEvent
import android.view.View
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.EditText
import android.widget.ListView
import android.widget.TextView
import android.widget.Toast

class MainActivity : Activity() {

    private val tv = TvClient()
    private lateinit var discovery: NsdDiscovery
    private val devices = mutableListOf<TvDevice>()
    private val handler = Handler(Looper.getMainLooper())

    private lateinit var statusText: TextView
    private lateinit var lastResponse: TextView
    private lateinit var deviceList: ListView
    private lateinit var ipInput: EditText
    private lateinit var portInput: EditText
    private lateinit var remotePanel: View

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        discovery = NsdDiscovery(this)
        statusText = findViewById(R.id.statusText)
        lastResponse = findViewById(R.id.lastResponse)
        deviceList = findViewById(R.id.deviceList)
        ipInput = findViewById(R.id.ipInput)
        portInput = findViewById(R.id.portInput)
        remotePanel = findViewById(R.id.remotePanel)

        val adapter = ArrayAdapter(
            this,
            android.R.layout.simple_list_item_1,
            devices.map { describe(it) }.toMutableList(),
        )
        deviceList.adapter = adapter

        findViewById<Button>(R.id.scanBtn).setOnClickListener { scan(adapter) }
        findViewById<Button>(R.id.connectBtn).setOnClickListener { connect() }
        findViewById<Button>(R.id.disconnectBtn).setOnClickListener {
            tv.disconnect()
            setStatus("Disconnected", muted = true)
        }

        deviceList.setOnItemClickListener { _, _, position, _ ->
            devices.getOrNull(position)?.let { d ->
                ipInput.setText(d.ip)
                portInput.setText((d.websocketPort ?: d.port).toString())
            }
        }

        // VERIFIED keys (RemoteFragment listeners in the original app).
        bindKey(R.id.keyUp, 19)
        bindKey(R.id.keyDown, 20)
        bindKey(R.id.keyLeft, 21)
        bindKey(R.id.keyRight, 22)
        bindKey(R.id.keyOk, 23)
        bindKey(R.id.keyBack, 4)
        bindKey(R.id.keyHome, 3)
        bindKey(R.id.keyMenu, 82)
        bindKey(R.id.powerBtn, 26)
        bindKey(R.id.inputBtn, 178)
        bindRepeatKey(R.id.volUp, 24)
        bindRepeatKey(R.id.volDown, 25)

        // EXPERIMENTAL keys (labelled "~" in the UI).
        bindKey(R.id.volMute, 164)
        bindKey(R.id.playBtn, 126)
        bindKey(R.id.pauseBtn, 127)

        findViewById<Button>(R.id.kbdSend).setOnClickListener {
            val text = findViewById<EditText>(R.id.kbdInput).text.toString()
            if (text.isBlank()) return@setOnClickListener
            sendKey({ tv.sendText(text) }, "Text sent")
            findViewById<EditText>(R.id.kbdInput).setText("")
        }

        tv.listener = object : TvClient.Listener {
            override fun onOpen() = runOnUiThread {
                setStatus("Connected ✓ ${tv.address}", ok = true)
            }
            override fun onClosed(willReconnect: Boolean) = runOnUiThread {
                setStatus(if (willReconnect) "Reconnecting…" else "Offline", muted = true)
            }
            override fun onFailure(e: Throwable) = runOnUiThread {
                setStatus("Connection error — retrying", muted = true)
            }
            override fun onTvResponse(body: String) = runOnUiThread {
                lastResponse.text = "Last TV response: " + body.take(120)
            }
        }
    }

    private fun describe(d: TvDevice): String {
        val port = d.websocketPort ?: d.port
        return "${d.name} — ${d.ip}:$port"
    }

    private fun scan(adapter: ArrayAdapter<String>) {
        devices.clear()
        adapter.clear()
        adapter.notifyDataSetChanged()
        setStatus("Scanning…", muted = true)
        discovery.discover(
            onFound = { d ->
                runOnUiThread {
                    if (devices.none { it.ip == d.ip && it.port == d.port }) {
                        devices.add(d)
                        adapter.clear()
                        adapter.addAll(devices.map { describe(it) })
                        adapter.notifyDataSetChanged()
                    }
                }
            },
            onError = { msg -> runOnUiThread { toast(msg) } },
        )
        handler.postDelayed({ discovery.stop() }, 8000)
    }

    private fun connect() {
        val ip = ipInput.text.toString().trim()
        val explicitPort = portInput.text.toString().trim().toIntOrNull()
        val port = explicitPort ?: 0
        val ipOk = Regex("^(\\d{1,3}\\.){3}\\d{1,3}$").matches(ip)
        if (!ipOk || port <= 0) {
            toast("Enter a valid TV IP and port (scan first, or see docs/android-guide.md)")
            return
        }
        setStatus("Connecting to $ip:$port…", muted = true)
        tv.connect(ip, port)
    }

    private fun bindKey(viewId: Int, code: Int) {
        findViewById<Button>(viewId).setOnClickListener { v ->
            v.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY)
            sendKey({ tv.sendKey(code) })
        }
    }

    private fun bindRepeatKey(viewId: Int, code: Int) {
        findViewById<Button>(viewId).setOnTouchListener { v, ev ->
            when (ev.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    v.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY)
                    sendKey({ tv.sendKey(code) })
                    handler.postDelayed({ repeat(code) }, 420)
                }
                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL ->
                    handler.removeCallbacksAndMessages(null)
            }
            true
        }
    }

    private fun repeat(code: Int) {
        sendKey({ tv.sendKey(code) })
        handler.postDelayed({ repeat(code) }, 160)
    }

    private fun sendKey(send: () -> Unit, successMsg: String? = null) {
        try {
            send()
            if (successMsg != null) toast(successMsg)
        } catch (e: Exception) {
            toast(e.message ?: "Not connected — connect to a TV first")
        }
    }

    private fun setStatus(text: String, ok: Boolean = false, muted: Boolean = false) {
        statusText.text = text
        statusText.setTextColor(
            when {
                ok -> getColor(R.color.ok)
                muted -> getColor(R.color.muted)
                else -> getColor(R.color.text)
            }
        )
    }

    private fun toast(msg: String) {
        Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()
    }

    override fun onDestroy() {
        super.onDestroy()
        discovery.stop()
        tv.disconnect()
    }
}