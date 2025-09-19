set("log.file.path", "./logs/liquidsoap.log")
set("log.stdout", true)
set("log.level", 3)

set("server.telnet", true)
set("server.telnet.bind_addr", "127.0.0.1")
set("server.telnet.port", 1234)

set("audio.converter.samplerate.libsamplerate.quality", "best")
set("decoder.file_extensions.mp3", ["mp3"])
set("decoder.file_extensions.flac", ["flac"])
set("decoder.file_extensions.ogg", ["ogg", "oga"])
set("decoder.file_extensions.wav", ["wav"])


playlist_file = "./playlists/current.m3u"

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


output.icecast(
    %mp3(bitrate=128, samplerate=44100, stereo=true),
    id="icecast_output",
    host="localhost",
    port=8900,
    password="radio123",
    mount="/radio",
    name="Static.FM",
    description="24 hours no stop",
    url="http://localhost:8900",
    genre="Various",
    encoding="utf-8",
    radio_source
)

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

current_title = ref("")
current_artist = ref("")


def on_track_start(m) =
    current_title := m["title"]
    current_artist := m["artist"]
    log("Now playing: #{!current_artist} - #{!current_title}")

    current_info = "#{!current_artist} - #{!current_title}"
    file.write(data="#{current_info}", "./logs/current_track.txt")
end


def current_song(_) =
    "Now playing: #{!current_artist} - #{!current_title}"
end
server.register("current", current_song)



log("=== network radio starting ===")
log("Icecast address: http://localhost:8900/radio")
log("Telnet control: telnet localhost 1234")
log("Playlist: #{playlist_file}")
log("Log file: ./logs/liquidsoap.log")
log("==============================")


radio_source.on_track(on_track_start)

# add_timeout(3600.0, fun() -> {
#     log("Hourly status check - Radio is running")
#     3600.0
# })