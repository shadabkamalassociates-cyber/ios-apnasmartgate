import sys
import re

file_path = 'ios/kamalSociety.xcodeproj/project.pbxproj'

with open(file_path, 'r') as f:
    content = f.read()

if 'mygate.mp3' in content:
    print('mygate.mp3 already added')
    sys.exit(0)

# 1. Add to PBXBuildFile
build_file_str = "/* Begin PBXBuildFile section */\n\t\tAA00000000000000000000D2 /* mygate.mp3 in Resources */ = {isa = PBXBuildFile; fileRef = AA00000000000000000000D1 /* mygate.mp3 */; };"
content = content.replace("/* Begin PBXBuildFile section */", build_file_str)

# 2. Add to PBXFileReference
file_ref_str = "/* Begin PBXFileReference section */\n\t\tAA00000000000000000000D1 /* mygate.mp3 */ = {isa = PBXFileReference; lastKnownFileType = audio.mp3; name = mygate.mp3; path = mygate.mp3; sourceTree = \"<group>\"; };"
content = content.replace("/* Begin PBXFileReference section */", file_ref_str)

# 3. Add to PBXGroup kamalSociety
group_pattern = r'(13B07FAE1A68108700A75B9A \/\* kamalSociety \*\/ = \{\s*isa = PBXGroup;\s*children = \()'
group_replacement = r'\1\n\t\t\t\tAA00000000000000000000D1 /* mygate.mp3 */,'
content = re.sub(group_pattern, group_replacement, content)

# 4. Add to PBXResourcesBuildPhase Resources
resources_pattern = r'(13B07F8E1A680F5B00A75B9A \/\* Resources \*\/ = \{\s*isa = PBXResourcesBuildPhase;\s*buildActionMask = [0-9]+;\s*files = \()'
resources_replacement = r'\1\n\t\t\t\tAA00000000000000000000D2 /* mygate.mp3 in Resources */,'
content = re.sub(resources_pattern, resources_replacement, content)

with open(file_path, 'w') as f:
    f.write(content)

print('Successfully added mygate.mp3 to PBXProj')
