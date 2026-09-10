# -*- coding: utf-8 -*-
"""P1-07：版本号单一真源一致性（version.json / package.json / build.gradle）。"""
import os
import re
import json
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class VersionConsistencyTest(unittest.TestCase):

    def setUp(self):
        with open(os.path.join(ROOT, 'version.json'), encoding='utf-8') as f:
            self.meta = json.load(f)
        with open(os.path.join(ROOT, 'package.json'), encoding='utf-8') as f:
            self.pkg = json.load(f)
        with open(os.path.join(ROOT, 'android', 'app', 'build.gradle'), encoding='utf-8') as f:
            self.gradle = f.read()

    def test_versionName_across_sources(self):
        self.assertRegex(self.meta['versionName'], r'^\d+\.\d+\.\d+$', 'versionName 应为 x.y.z 语义化版本')
        self.assertEqual(self.pkg['version'], self.meta['versionName'], 'package.json.version 必须等于 version.json.versionName')

    def test_versionCode_is_positive_int(self):
        self.assertIsInstance(self.meta['versionCode'], int)
        self.assertGreater(self.meta['versionCode'], 0)

    def test_build_gradle_derives_from_version_json(self):
        # build.gradle 不再硬编码，改为从 ../../version.json 派生
        self.assertIn('vjson.versionCode', self.gradle)
        self.assertIn('vjson.versionName', self.gradle)
        self.assertIn('version.json', self.gradle)
        # 不得再出现写死的 versionCode 数字 / versionName 字面量
        self.assertIsNone(re.search(r'versionCode\s+\d', self.gradle), 'build.gradle 仍硬编码 versionCode')
        self.assertIsNone(re.search(r'versionName\s+"', self.gradle), 'build.gradle 仍硬编码 versionName')

    def test_build_gradle_fallback_matches_meta(self):
        # 兜底值必须与真源一致，避免读不到 version.json 时漂移
        m_code = re.search(r'versionCode:\s*(\d+)', self.gradle)
        m_name = re.search(r"versionName:\s*'([^']+)'", self.gradle)
        self.assertIsNotNone(m_code)
        self.assertIsNotNone(m_name)
        self.assertEqual(int(m_code.group(1)), self.meta['versionCode'])
        self.assertEqual(m_name.group(1), self.meta['versionName'])

    def test_apk_url_matches_version_name(self):
        self.assertIn('v' + self.meta['versionName'], self.meta['apkUrl'])


if __name__ == '__main__':
    unittest.main()
