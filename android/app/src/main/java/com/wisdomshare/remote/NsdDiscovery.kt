// mDNS/DNS-SD discovery for the TV's `_share._tcp` service via Android NSD.
// Port of bridge/discovery.js / SearchApi.java: browse `_share._tcp`, resolve
// SRV port + host, read TXT attributes (device_mac, device_name, device_code,
// device_ip, http_port, websocket_port).

import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.os.Build
import java.util.concurrent.Executor

data class TvDevice(
    val name: String,
    val ip: String,
    val port: Int,
    val httpPort: Int? = null,
    val websocketPort: Int? = null,
    val mac: String? = null,
    val deviceCode: String? = null,
    val txt: Map<String, String> = emptyMap(),
)

class NsdDiscovery(private val context: Context) {

    private val nsd = context.getSystemService(Context.NSD_SERVICE) as NsdManager
    private var discoveryListener: NsdManager.DiscoveryListener? = null

    // Android 14 (API 34) requires the executor variants of the NSD calls and
    // Context.mainExecutor only exists on API 28+, so resolve it lazily and only
    // when the executor variants are actually used. Pre-34 uses the legacy calls.
    private fun callbackExecutor(): Executor =
        if (Build.VERSION.SDK_INT >= 28) context.mainExecutor
        else Executor { it.run() }

    fun discover(onFound: (TvDevice) -> Unit, onError: (String) -> Unit) {
        stop()
        val dl = object : NsdManager.DiscoveryListener {
            override fun onDiscoveryStarted(serviceType: String?) {}
            override fun onStartDiscoveryFailed(serviceType: String?, errorCode: Int) {
                onError("discovery start failed ($errorCode)")
            }
            override fun onStopDiscoveryFailed(serviceType: String?, errorCode: Int) {}
            override fun onDiscoveryStopped(serviceType: String?) {}
            override fun onServiceLost(serviceInfo: NsdServiceInfo?) {}
            override fun onServiceFound(serviceInfo: NsdServiceInfo) {
                val type = serviceInfo.serviceType ?: return
                if (!type.startsWith("_share._tcp")) return
                resolve(serviceInfo, onFound, onError)
            }
        }
        discoveryListener = dl
        try {
            if (Build.VERSION.SDK_INT >= 34) {
                // Android 14 requires the executor variants; use the app's main executor.
                nsd.discoverServices("_share._tcp.", NsdManager.PROTOCOL_TYPE_DNS_SD, callbackExecutor(), dl)
            } else {
                @Suppress("DEPRECATION")
                nsd.discoverServices("_share._tcp.", NsdManager.PROTOCOL_TYPE_DNS_SD, dl)
            }
        } catch (e: Exception) {
            onError(e.message ?: "discovery error")
        }
    }

    private fun resolve(info: NsdServiceInfo, onFound: (TvDevice) -> Unit, onError: (String) -> Unit) {
        val rl = object : NsdManager.ResolveListener {
            override fun onResolveFailed(info: NsdServiceInfo?, errorCode: Int) {
                onError("resolve failed ($errorCode)")
            }

            override fun onServiceResolved(resolved: NsdServiceInfo) {
                val txt: Map<String, String> = resolved.attributes.mapValues { (_, v) ->
                    v?.toString(Charsets.UTF_8) ?: ""
                }
                val host = resolved.host?.hostAddress ?: txt["device_ip"] ?: return
                onFound(
                    TvDevice(
                        name = txt["device_name"] ?: resolved.serviceName,
                        ip = host,
                        port = resolved.port,
                        httpPort = txt["http_port"]?.toIntOrNull(),
                        websocketPort = txt["websocket_port"]?.toIntOrNull(),
                        mac = txt["device_mac"],
                        deviceCode = txt["device_code"],
                        txt = txt,
                    )
                )
            }
        }
        try {
            if (Build.VERSION.SDK_INT >= 34) {
                nsd.resolveService(info, callbackExecutor(), rl)
            } else {
                @Suppress("DEPRECATION")
                nsd.resolveService(info, rl)
            }
        } catch (e: Exception) {
            onError(e.message ?: "resolve error")
        }
    }

    fun stop() {
        val dl = discoveryListener ?: return
        try { nsd.stopServiceDiscovery(dl) } catch (_: Exception) {}
        discoveryListener = null
    }
}