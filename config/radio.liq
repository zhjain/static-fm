# ==============================
#  Liquidsoap 配置（从 .env 读取）
# ==============================

# --- 日志 ---
log_file = get_process_env("LIQ_LOG_FILE", "./logs/liquidsoap.log")
settings.log.file.path.set(log_file)
settings.log.stdout.set(true)
settings.log.level.set(3)

# --- Telnet ---
telnet_port = int_of_string(get_process_env("LIQ_TELNET_PORT", "1234"))
settings.server.telnet.set(true)
settings.server.telnet.bind_addr.set("127.0.0.1")
settings.server.telnet.port.set(telnet_port)

# --- 音频解码 ---
settings.audio.converter.samplerate.libsamplerate.quality.set("best")
settings.decoder.file_extensions.mp3.set(["mp3"])
settings.decoder.file_extensions.flac.set(["flac"])
settings.decoder.file_extensions.ogg.set(["ogg", "oga"])
settings.decoder.file_extensions.wav.set(["wav"])

# --- 播放列表 ---
playlist_file = get_process_env("LIQ_PLAYLIST_FILE", "./playlists/current.m3u")

def create_default_playlist() =
    if not file.exists(playlist_file) then
        file.write(data="# default playlist\n# please use the admin page to add music\n", playlist_file)
    end
end

create_default_playlist()

music_source = playlist(
    id="main_playlist",
    reload_mode="watch",
    mime_type="audio/mpeg",
    playlist_file
)

silence_source = blank(id="silense", duration=2.0)

emergency_source = single(id="emergency", "./config/silence.mp3")

radio_source = fallback(
    track_sensitive=false,
    id="fallback_chain",
    [music_source, emergency_source, silence_source]
)

# --- 音频处理 ---
radio_source = normalize(
    id="normalize", 
    target=0.2, 
    window=0.03, 
    gain_min=0.8,
    gain_max=8.0,
    radio_source
)

# radio_source = crossfade(
#     id="crossfade",
#     duration=3.0,
#     fade_in=1.5,
#     fade_out=1.5,
#     radio_source
# )

radio_source = compress(
    id="compressor",
    attack=50.0,
    release=200.0,
    threshold=-15.0,
    ratio=3.0,
    gain=2.0,
    radio_source
)

# --- Icecast 输出 ---
icecast_host = get_process_env("ICECAST_HOST", "localhost")
icecast_port = int_of_string(get_process_env("ICECAST_PORT", "8900"))
icecast_password = get_process_env("ICECAST_PASSWORD", "radio123")
icecast_mount = get_process_env("ICECAST_MOUNT", "/radio")

output.icecast(
    %mp3(bitrate=128, samplerate=44100, stereo=true),
    id="icecast_output",
    host=icecast_host,
    port=icecast_port,
    password=icecast_password,
    mount=icecast_mount,
    name=get_process_env("ICECAST_NAME", "Static.FM"),
    description=get_process_env("ICECAST_DESCRIPTION", "24 hours no stop"),
    url=get_process_env("ICECAST_URL", "http://localhost:8900"),
    genre=get_process_env("ICECAST_GENRE", "Various"),
    encoding="utf-8",
    radio_source
)

# --- Telnet 控制命令 ---
def skip_track(_) = 
    music_source.skip()
    "Skipped to next track"
end
server.register("skip", skip_track)

def reload_playlist(_) =
    music_source.reload()
    "Playlist reloaded"
end
server.register("reload", reload_playlist)

# --- 当前歌曲信息 ---
current_title = ref("")
current_artist = ref("")


def on_track_start(m) =
    current_title := m["title"]
    current_artist := m["artist"]
    log("Now playing: #{!current_artist} - #{!current_title}")

    current_info = "#{!current_artist} - #{!current_title}"
    file.write(data="#{current_info}", "./logs/current_track.txt")

    # --- 发布到 API ---
    api_host = get_process_env("LIQ_API_HOST", "localhost")
    api_port = get_process_env("LIQ_API_PORT", "3000")
    system("curl -s -X POST http://#{api_host}:#{api_port}/publish -d 'artist=#{!current_artist}&title=#{!current_title}'")
end


def current_song(_) =
    "Now playing: #{!current_artist} - #{!current_title}"
end
server.register("current", current_song)


# --- 启动日志 ---
log("=== network radio starting ===")
log("Icecast address: http://localhost:8900/radio")
log("Telnet control: telnet localhost 1234")
log("Playlist: #{playlist_file}")
log("Log file: ./logs/liquidsoap.log")
log("==============================")

# --- 绑定事件 ---
radio_source.on_track(on_track_start)

# add_timeout(3600.0, fun() -> {
#     log("Hourly status check - Radio is running")
#     3600.0
# })