package com.youtaix656.shinkyu

import android.content.ContentValues
import android.content.Intent
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import androidx.core.content.FileProvider
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.io.File

/**
 * アプリ版（WebView）では <a download> によるファイルの保存が効かない
 * （Android の WebView はダウンロードを自分では行わない）ので、
 * バックアップなどの書き出しをここで代わりに行う。
 * JS 側は src/lib/nativeBridge.js の nativeSaveTextFile / nativeShareTextFile。
 *
 * - save：端末の「ダウンロード」フォルダへ保存（Android 10 以上は MediaStore、
 *   9 以下はこのアプリ専用のダウンロードフォルダ）。
 * - share：共有シート（Google ドライブ・LINE・メール等）へ渡す。
 */
@CapacitorPlugin(name = "BackupFile")
class BackupFilePlugin : Plugin() {

    @PluginMethod
    fun save(call: PluginCall) {
        val name = safeName(call.getString("filename"))
        val content = call.getString("content")
        if (content == null) {
            call.reject("content がありません")
            return
        }
        val mime = call.getString("mime") ?: "application/json"
        try {
            val ret = JSObject()
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val resolver = context.contentResolver
                val values = ContentValues().apply {
                    put(MediaStore.Downloads.DISPLAY_NAME, name)
                    put(MediaStore.Downloads.MIME_TYPE, mime)
                    put(MediaStore.Downloads.IS_PENDING, 1)
                }
                val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                if (uri == null) {
                    call.reject("保存先を作れませんでした")
                    return
                }
                val out = resolver.openOutputStream(uri)
                if (out == null) {
                    call.reject("保存先に書き込めませんでした")
                    return
                }
                out.use { it.write(content.toByteArray(Charsets.UTF_8)) }
                val done = ContentValues().apply { put(MediaStore.Downloads.IS_PENDING, 0) }
                resolver.update(uri, done, null, null)
                ret.put("location", "ダウンロード")
            } else {
                val dir = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS) ?: context.filesDir
                dir.mkdirs()
                val file = File(dir, name)
                file.writeText(content, Charsets.UTF_8)
                ret.put("location", file.absolutePath)
            }
            ret.put("filename", name)
            call.resolve(ret)
        } catch (e: Exception) {
            call.reject(e.message ?: "保存に失敗しました")
        }
    }

    @PluginMethod
    fun share(call: PluginCall) {
        val name = safeName(call.getString("filename"))
        val content = call.getString("content")
        if (content == null) {
            call.reject("content がありません")
            return
        }
        val mime = call.getString("mime") ?: "application/json"
        try {
            val dir = File(context.cacheDir, "share")
            dir.mkdirs()
            val file = File(dir, name)
            file.writeText(content, Charsets.UTF_8)
            val uri = FileProvider.getUriForFile(context, context.packageName + ".fileprovider", file)
            val send = Intent(Intent.ACTION_SEND).apply {
                type = mime
                putExtra(Intent.EXTRA_STREAM, uri)
                putExtra(Intent.EXTRA_SUBJECT, name)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            val chooser = Intent.createChooser(send, "バックアップを送る").apply {
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            val act = activity
            if (act != null) act.startActivity(chooser)
            else context.startActivity(chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            call.resolve()
        } catch (e: Exception) {
            call.reject(e.message ?: "共有に失敗しました")
        }
    }

    // ファイル名にフォルダの区切りなどを入れさせない
    private fun safeName(raw: String?): String {
        val s = (raw ?: "shinkyu_backup.json").replace(Regex("[\\\\/:*?\"<>|]"), "_").trim()
        return if (s.isEmpty()) "shinkyu_backup.json" else s
    }
}
