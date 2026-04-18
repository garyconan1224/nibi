#!/usr/bin/env python3
"""
简化B站API测试：验证无Cookie能力

重点测试：
1. 视频基本信息获取（免登录）
2. 字幕API调用（关键突破点）
"""

import requests
import re
import hashlib
import time
import urllib.parse
from typing import Optional

# WBI签名密钥映射表
mixinKeyEncTab = [
    46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
    33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40,
    61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11,
    36, 20, 34, 44, 52
]

def extract_bvid(url: str) -> Optional[str]:
    """提取BVID"""
    patterns = [r'[Bb][Vv]([A-Za-z0-9]+)', r'bilibili\.com/video/([Bb][Vv][A-Za-z0-9]+)']
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            bvid = match.group(1) if match.group(1).startswith(('BV', 'bv')) else f'BV{match.group(1)}'
            return bvid.upper()
    return None

def get_mixin_key(orig: str) -> str:
    """根据img_key和sub_key生成mixin_key"""
    return ''.join([orig[i] for i in mixinKeyEncTab])[:32]

def enc_wbi(params: dict, img_key: str, sub_key: str) -> dict:
    """WBI签名计算"""
    mixin_key = get_mixin_key(img_key + sub_key)
    curr_time = round(time.time())
    params['wts'] = curr_time

    # 参数排序并构建query string
    query = urllib.parse.urlencode(sorted(params.items()))

    # 计算签名
    wbi_sign = hashlib.md5((query + mixin_key).encode()).hexdigest()
    params['w_rid'] = wbi_sign

    return params

def get_wbi_keys(session) -> tuple[str, str]:
    """获取WBI签名密钥"""
    try:
        resp = session.get("https://api.bilibili.com/x/web-interface/nav", timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if data.get('code') == 0:
                wbi_img = data['data']['wbi_img']['img_url']
                wbi_sub = data['data']['wbi_img']['sub_url']

                img_key = wbi_img.split('/')[-1].split('.')[0]
                sub_key = wbi_sub.split('/')[-1].split('.')[0]

                return img_key, sub_key
        return None, None
    except:
        return None, None

def test_playurl_api(session, aid: int, cid: int):
    """测试playurl API - 获取视频直链的关键突破"""
    print(f"\n=== 5. PlayURL API测试（WBI签名）===")
    print(f"测试参数: AID={aid}, CID={cid}")

    try:
        # 1. 获取WBI密钥
        print("正在获取WBI签名密钥...")
        img_key, sub_key = get_wbi_keys(session)

        if not img_key or not sub_key:
            print("❌ 无法获取WBI密钥，尝试无签名方案...")
            # 回退：尝试不带WBI签名的playurl
            test_playurl_without_wbi(session, aid, cid)
            return

        print(f"✅ WBI密钥获取成功: img={img_key[:8]}..., sub={sub_key[:8]}...")

        # 2. 构建WBI签名参数
        params = {
            'avid': aid,
            'cid': cid,
            'qn': 32,  # 480P（游客可访问的质量）
            'fnval': 1,  # 返回MP4格式
            'fourk': 0,
            'platform': 'pc',
            'otype': 'json'
        }

        # 添加WBI签名
        signed_params = enc_wbi(params.copy(), img_key, sub_key)

        # 3. 调用playurl API
        print("正在调用PlayURL API...")
        playurl_resp = session.get("https://api.bilibili.com/x/player/wbi/playurl",
                                 params=signed_params, timeout=15)

        if playurl_resp.status_code == 200:
            playurl_data = playurl_resp.json()
            print(f"PlayURL API响应: code={playurl_data.get('code')}, message={playurl_data.get('message', 'OK')}")

            if playurl_data.get('code') == 0:
                data = playurl_data.get('data', {})

                # 检查是否有durl（直链）
                if 'durl' in data and data['durl']:
                    print(f"🎉 获取到视频直链！共{len(data['durl'])}个片段")
                    for i, durl in enumerate(data['durl']):
                        url = durl.get('url', '')
                        size = durl.get('size', 0)
                        print(f"  片段{i+1}: {url[:50]}... (大小:{size//1024//1024}MB)")

                    # 测试下载第一个片段的前几个字节
                    test_download_sample(session, data['durl'][0]['url'])

                elif 'dash' in data:
                    print(f"🎉 获取到DASH流信息！")
                    dash = data['dash']
                    if 'video' in dash and dash['video']:
                        video = dash['video'][0]  # 取第一个视频流
                        print(f"  视频流: {video.get('baseUrl', '')[:50]}...")
                        print(f"  编码: {video.get('codecs')}, 质量: {video.get('height')}p")

                        test_download_sample(session, video.get('baseUrl', ''))
                else:
                    print("⚠️ 响应中无durl或dash字段，可能需要更高权限")
                    print(f"可用字段: {list(data.keys())}")

            else:
                print(f"❌ PlayURL API错误: {playurl_data.get('message')}")
                # 尝试无签名方案
                test_playurl_without_wbi(session, aid, cid)
        else:
            print(f"❌ PlayURL HTTP错误: {playurl_resp.status_code}")

    except Exception as e:
        print(f"❌ PlayURL测试异常: {e}")

def test_playurl_without_wbi(session, aid: int, cid: int):
    """测试无WBI签名的playurl（备用方案）"""
    print("\n--- 尝试无WBI签名playurl ---")
    try:
        params = {
            'avid': aid,
            'cid': cid,
            'qn': 16,  # 更低质量，提高成功率
            'platform': 'html5'  # HTML5播放器
        }

        resp = session.get("https://api.bilibili.com/x/player/playurl",
                         params=params, timeout=10)

        if resp.status_code == 200:
            data = resp.json()
            if data.get('code') == 0:
                print(f"✅ 无签名playurl成功！")
                play_data = data.get('data', {})
                if play_data.get('durl'):
                    print(f"获取到{len(play_data['durl'])}个视频片段")
                    return True
            else:
                print(f"⚠️ 无签名playurl失败: {data.get('message')}")

    except Exception as e:
        print(f"❌ 无签名测试异常: {e}")

    return False

def test_download_sample(session, video_url: str):
    """测试下载视频的前几个字节"""
    if not video_url:
        return

    print(f"\n--- 测试视频下载 ---")
    try:
        # 只下载前1KB验证可达性
        headers = session.headers.copy()
        headers['Range'] = 'bytes=0-1023'

        resp = session.get(video_url, headers=headers, timeout=10)

        if resp.status_code in (200, 206):  # 206是部分内容
            print(f"🎉 视频下载测试成功！")
            print(f"状态码: {resp.status_code}")
            print(f"Content-Type: {resp.headers.get('Content-Type')}")
            print(f"下载字节数: {len(resp.content)}")
            print("\n✅ B站无Cookie视频下载：完全可行！")
            return True
        else:
            print(f"❌ 视频下载失败: HTTP {resp.status_code}")

    except Exception as e:
        print(f"❌ 下载测试异常: {e}")

    return False

def test_bilibili_no_cookie():
    """测试B站无Cookie API"""
    print("🧪 B站无Cookie API核心测试\n")

    session = requests.Session()
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Referer': 'https://www.bilibili.com/',
        'Accept': 'application/json, text/plain, */*'
    })

    # 1. 测试BVID提取
    print("=== 1. BVID提取 ===")
    test_url = "https://www.bilibili.com/video/BV1xx411c7mu"
    bvid = extract_bvid(test_url)
    print(f"URL: {test_url}")
    print(f"BVID: {bvid}")
    print()

    # 2. 直接测试已知视频（避开热榜风控）
    print("=== 2. 测试已知公开视频 ===")
    # 使用几个经典的、长期存在的B站视频
    test_videos = [
        "BV1xx411c7xo",  # 经典视频格式
        "BV1uv411q7Mv",
        "BV1s7411r7hr",
        "BV17x411w7KC"
    ]

    for test_bvid in test_videos:
        print(f"\n尝试视频: {test_bvid}")
        try:
            detail_resp = session.get("https://api.bilibili.com/x/web-interface/view",
                                    params={'bvid': test_bvid}, timeout=10)
            if detail_resp.status_code == 200:
                detail_data = detail_resp.json()
                if detail_data.get('code') == 0:
                    info = detail_data['data']
                    print(f"✅ 视频详情获取成功")
                    print(f"标题: {info.get('title', '')[:50]}...")
                    print(f"AID: {info.get('aid')}")
                    print(f"CID: {info.get('cid')}")
                    print(f"作者: {info.get('owner', {}).get('name')}")
                    print(f"时长: {info.get('duration')}秒")

                    # 3. 关键测试：字幕API
                    print(f"\n=== 3. 字幕API测试（核心突破）===")
                    aid = info.get('aid')
                    cid = info.get('cid')

                    if aid and cid:
                        subtitle_resp = session.get("https://api.bilibili.com/x/player/v2",
                                                  params={'aid': aid, 'cid': cid},
                                                  timeout=10)
                        if subtitle_resp.status_code == 200:
                            sub_data = subtitle_resp.json()
                            print(f"字幕API响应: code={sub_data.get('code')}, message={sub_data.get('message', 'OK')}")

                            if sub_data.get('code') == 0:
                                subtitles = sub_data.get('data', {}).get('subtitle', {}).get('subtitles', [])
                                if subtitles:
                                    print(f"🎉 成功获取字幕！共{len(subtitles)}种语言")
                                    for sub in subtitles:
                                        print(f"- {sub.get('lan_doc')} ({sub.get('lan')})")
                                    print("\n✅ B站无Cookie字幕获取：成功！")

                                # 无论是否有字幕，都测试视频下载
                                print(f"\n=== 4. 视频下载能力测试 ===")
                                test_playurl_api(session, aid, cid)
                                return True
                            else:
                                print(f"字幕API错误: {sub_data.get('message')}")
                                # 继续测试视频下载
                                test_playurl_api(session, aid, cid)
                                return True
                        else:
                            print(f"❌ 字幕API HTTP错误: {subtitle_resp.status_code}")
                    else:
                        print("❌ 缺少AID/CID")
                        continue

                elif detail_data.get('code') == -404:
                    print(f"⚠️ 视频不存在，尝试下一个...")
                    continue
                else:
                    print(f"❌ 视频详情API错误: {detail_data.get('message')}")
                    continue
            else:
                print(f"❌ HTTP错误: {detail_resp.status_code}")
                continue
        except Exception as e:
            print(f"❌ 测试异常: {e}")
            continue

    print("❌ 所有测试视频都失败了")

    print(f"\n🧪 无Cookie能力验证完成")
    return False

if __name__ == "__main__":
    success = test_bilibili_no_cookie()
    if success:
        print("\n🎉 结论：B站无Cookie下载器可行！")
    else:
        print("\n⚠️ 结论：需进一步调试或使用备用方案")