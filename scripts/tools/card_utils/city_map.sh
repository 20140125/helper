#!/bin/bash
# ======================================
# card_utils 子模块：城市名归一化（中文/拼音 → 统一 slug）
# ======================================
# 被 card_utils.sh 主入口 source，禁止直接执行
# 提供：normalize_city_slug
# ======================================
#
# 背景：缓存 key / URL slug 直接用入参原样时，"深圳" / "深圳市" / "shenzhen"
# 会被当成三个不同城市，各写一份内容完全相同的缓存文件（白白多占归档目录）。
# 本模块把同一城市的不同写法收敛到同一个 key。
#
# 归一化顺序：
#   1. 去首尾空白 + 转小写
#   2. 空格 / 下划线 → "-"（兼容 "New York" → new-york）
#   3. 去行政后缀：市 / 县 / 区 / 省（深圳市 → 深圳）
#   4. 中文 ↔ 拼音双向映射（深圳 → shenzhen；入参本身是拼音则原样返回）
#   5. 表中没有的城市原样返回，保证不劣化原有行为
#
# 覆盖范围：
#   - 全部直辖市、地级市、地区、盟、自治州（333 个地级行政区）
#   - 热门县级市 / 省直管县（昆山、义乌、仙桃等）
#   - 表外城市（多数县、县级市）保持原文归档：中文写法之间已合并
#     （"惠州市" → "惠州"），只有"中文 vs 手写拼音"并存时才可能出现两份
#
# 维护约定（重要）：
#   1. 拼音按普通话读音；多音字按地名习惯读音（六安 luan、蚌埠 bengbu、
#      亳州 bozhou、雅安 yaan、百色 baise）
#   2. **拼音撞车的城市不收表**：不同城市若拼音完全相同，会被归并成同一份缓存
#      进而互相串数据，后果比多一个文件严重。已知撞车（只收前者）：
#        苏州(suzhou) / 宿州 · 福州(fuzhou) / 抚州 · 宜春(yichun) / 伊春
#        台州(taizhou) / 泰州 · 榆林(yulin) / 玉林
#   3. 归一化值只用于缓存 key 与（可选的）URL slug；新增城市往对应省份分组里加一行
#
# 更新：2026-10-14

# 中文 ↔ 拼音映射表
# 参数: $1=归一化后的城市名（已小写、已去行政后缀）
# 输出: 命中则输出拼音 slug；未命中输出空
_city_slug_lookup() {
    case "$1" in
        # ===== 直辖市 =====
        北京|beijing)                                   echo "beijing" ;;
        天津|tianjin)                                   echo "tianjin" ;;
        上海|shanghai)                                  echo "shanghai" ;;
        重庆|chongqing)                                 echo "chongqing" ;;
        # ===== 河北 =====
        石家庄|shijiazhuang)                            echo "shijiazhuang" ;;
        唐山|tangshan)                                  echo "tangshan" ;;
        秦皇岛|qinhuangdao)                             echo "qinhuangdao" ;;
        邯郸|handan)                                    echo "handan" ;;
        邢台|xingtai)                                   echo "xingtai" ;;
        保定|baoding)                                   echo "baoding" ;;
        张家口|zhangjiakou)                             echo "zhangjiakou" ;;
        承德|chengde)                                   echo "chengde" ;;
        沧州|cangzhou)                                  echo "cangzhou" ;;
        廊坊|langfang)                                  echo "langfang" ;;
        衡水|hengshui)                                  echo "hengshui" ;;
        雄安|xiongan)                                   echo "xiongan" ;;
        # ===== 山西 =====
        太原|taiyuan)                                   echo "taiyuan" ;;
        大同|datong)                                    echo "datong" ;;
        阳泉|yangquan)                                  echo "yangquan" ;;
        长治|changzhi)                                  echo "changzhi" ;;
        晋城|jincheng)                                  echo "jincheng" ;;
        朔州|shuozhou)                                  echo "shuozhou" ;;
        晋中|jinzhong)                                  echo "jinzhong" ;;
        运城|yuncheng)                                  echo "yuncheng" ;;
        忻州|xinzhou)                                   echo "xinzhou" ;;
        临汾|linfen)                                    echo "linfen" ;;
        吕梁|lvliang|luliang)                           echo "lvliang" ;;
        # ===== 内蒙古 =====
        呼和浩特|huhehaote|hohhot)                      echo "hohhot" ;;
        包头|baotou)                                    echo "baotou" ;;
        乌海|wuhai)                                     echo "wuhai" ;;
        赤峰|chifeng)                                   echo "chifeng" ;;
        通辽|tongliao)                                  echo "tongliao" ;;
        鄂尔多斯|eerduosi|ordos)                        echo "ordos" ;;
        呼伦贝尔|hulunbeier|hulunbuir)                  echo "hulunbuir" ;;
        巴彦淖尔|bayannaoer)                            echo "bayannaoer" ;;
        乌兰察布|wulanchabu)                            echo "wulanchabu" ;;
        兴安盟|xinganmeng)                              echo "xinganmeng" ;;
        锡林郭勒盟|锡林郭勒|xilinguole|shilingol)       echo "xilinguole" ;;
        阿拉善盟|阿拉善|alashan|alxa)                   echo "alashan" ;;
        # ===== 辽宁 =====
        沈阳|shenyang)                                  echo "shenyang" ;;
        大连|dalian)                                    echo "dalian" ;;
        鞍山|anshan)                                    echo "anshan" ;;
        抚顺|fushun)                                    echo "fushun" ;;
        本溪|benxi)                                     echo "benxi" ;;
        丹东|dandong)                                   echo "dandong" ;;
        锦州|jinzhou)                                   echo "jinzhou" ;;
        营口|yingkou)                                   echo "yingkou" ;;
        阜新|fuxin)                                     echo "fuxin" ;;
        辽阳|liaoyang)                                  echo "liaoyang" ;;
        盘锦|panjin)                                    echo "panjin" ;;
        铁岭|tieling)                                   echo "tieling" ;;
        朝阳|chaoyang)                                  echo "chaoyang" ;;
        葫芦岛|huludao)                                 echo "huludao" ;;
        # ===== 吉林 =====
        长春|changchun)                                 echo "changchun" ;;
        吉林|jilin)                                     echo "jilin" ;;
        四平|siping)                                    echo "siping" ;;
        辽源|liaoyuan)                                  echo "liaoyuan" ;;
        通化|tonghua)                                   echo "tonghua" ;;
        白山|baishan)                                   echo "baishan" ;;
        松原|songyuan)                                  echo "songyuan" ;;
        白城|baicheng)                                  echo "baicheng" ;;
        延边州|延边|yanbian)                            echo "yanbian" ;;
        # ===== 黑龙江 =====
        哈尔滨|haerbin|harbin)                          echo "harbin" ;;
        齐齐哈尔|qiqihaer)                              echo "qiqihaer" ;;
        鸡西|jixi)                                      echo "jixi" ;;
        鹤岗|hegang)                                    echo "hegang" ;;
        双鸭山|shuangyashan)                            echo "shuangyashan" ;;
        大庆|daqing)                                    echo "daqing" ;;
        # 注：伊春(yichun) 与江西宜春拼音撞车，不收表
        七台河|qitaihe)                                 echo "qitaihe" ;;
        牡丹江|mudanjiang)                              echo "mudanjiang" ;;
        黑河|heihe)                                     echo "heihe" ;;
        绥化|suihua)                                    echo "suihua" ;;
        大兴安岭地区|大兴安岭|daxinganling)             echo "daxinganling" ;;
        # ===== 江苏 =====
        南京|nanjing)                                   echo "nanjing" ;;
        无锡|wuxi)                                      echo "wuxi" ;;
        徐州|xuzhou)                                    echo "xuzhou" ;;
        常州|changzhou)                                 echo "changzhou" ;;
        苏州|suzhou)                                    echo "suzhou" ;;
        南通|nantong)                                   echo "nantong" ;;
        连云港|lianyungang)                             echo "lianyungang" ;;
        淮安|huaian)                                    echo "huaian" ;;
        盐城|yancheng)                                  echo "yancheng" ;;
        扬州|yangzhou)                                  echo "yangzhou" ;;
        镇江|zhenjiang)                                 echo "zhenjiang" ;;
        # 注：泰州(taizhou) 与浙江台州拼音撞车，不收表
        宿迁|suqian)                                    echo "suqian" ;;
        # ===== 浙江 =====
        杭州|hangzhou)                                  echo "hangzhou" ;;
        宁波|ningbo)                                    echo "ningbo" ;;
        温州|wenzhou)                                   echo "wenzhou" ;;
        嘉兴|jiaxing)                                   echo "jiaxing" ;;
        湖州|huzhou)                                    echo "huzhou" ;;
        绍兴|shaoxing)                                  echo "shaoxing" ;;
        金华|jinhua)                                    echo "jinhua" ;;
        衢州|quzhou)                                    echo "quzhou" ;;
        舟山|zhoushan)                                  echo "zhoushan" ;;
        台州|taizhou)                                   echo "taizhou" ;;
        丽水|lishui)                                    echo "lishui" ;;
        # ===== 安徽 =====
        合肥|hefei)                                     echo "hefei" ;;
        芜湖|wuhu)                                      echo "wuhu" ;;
        蚌埠|bengbu)                                    echo "bengbu" ;;
        淮南|huainan)                                   echo "huainan" ;;
        马鞍山|maanshan)                                echo "maanshan" ;;
        淮北|huaibei)                                   echo "huaibei" ;;
        铜陵|tongling)                                  echo "tongling" ;;
        安庆|anqing)                                    echo "anqing" ;;
        黄山|huangshan)                                 echo "huangshan" ;;
        阜阳|fuyang)                                    echo "fuyang" ;;
        # 注：宿州(suzhou) 与江苏苏州拼音撞车，不收表
        滁州|chuzhou)                                   echo "chuzhou" ;;
        六安|luan|liuan)                                echo "luan" ;;
        亳州|bozhou)                                    echo "bozhou" ;;
        池州|chizhou)                                   echo "chizhou" ;;
        宣城|xuancheng)                                 echo "xuancheng" ;;
        # ===== 福建 =====
        福州|fuzhou)                                    echo "fuzhou" ;;
        厦门|xiamen|amoy)                               echo "xiamen" ;;
        莆田|putian)                                    echo "putian" ;;
        三明|sanming)                                   echo "sanming" ;;
        泉州|quanzhou)                                  echo "quanzhou" ;;
        漳州|zhangzhou)                                 echo "zhangzhou" ;;
        南平|nanping)                                   echo "nanping" ;;
        龙岩|longyan)                                   echo "longyan" ;;
        宁德|ningde)                                    echo "ningde" ;;
        # ===== 江西 =====
        南昌|nanchang)                                  echo "nanchang" ;;
        景德镇|jingdezhen)                              echo "jingdezhen" ;;
        萍乡|pingxiang)                                 echo "pingxiang" ;;
        九江|jiujiang)                                  echo "jiujiang" ;;
        新余|xinyu)                                     echo "xinyu" ;;
        鹰潭|yingtan)                                   echo "yingtan" ;;
        赣州|ganzhou)                                   echo "ganzhou" ;;
        吉安|jian)                                      echo "jian" ;;
        宜春|yichun)                                    echo "yichun" ;;
        # 注：抚州(fuzhou) 与福建福州拼音撞车，不收表
        上饶|shangrao)                                  echo "shangrao" ;;
        # ===== 山东 =====
        济南|jinan)                                     echo "jinan" ;;
        青岛|qingdao)                                   echo "qingdao" ;;
        淄博|zibo)                                      echo "zibo" ;;
        枣庄|zaozhuang)                                 echo "zaozhuang" ;;
        东营|dongying)                                  echo "dongying" ;;
        烟台|yantai)                                    echo "yantai" ;;
        潍坊|weifang)                                   echo "weifang" ;;
        济宁|jining)                                    echo "jining" ;;
        泰安|taian)                                     echo "taian" ;;
        威海|weihai)                                    echo "weihai" ;;
        日照|rizhao)                                    echo "rizhao" ;;
        临沂|linyi)                                     echo "linyi" ;;
        德州|dezhou)                                    echo "dezhou" ;;
        聊城|liaocheng)                                 echo "liaocheng" ;;
        滨州|binzhou)                                   echo "binzhou" ;;
        菏泽|heze)                                      echo "heze" ;;
        # ===== 河南 =====
        郑州|zhengzhou)                                 echo "zhengzhou" ;;
        开封|kaifeng)                                   echo "kaifeng" ;;
        洛阳|luoyang)                                   echo "luoyang" ;;
        平顶山|pingdingshan)                            echo "pingdingshan" ;;
        安阳|anyang)                                    echo "anyang" ;;
        鹤壁|hebi)                                      echo "hebi" ;;
        新乡|xinxiang)                                  echo "xinxiang" ;;
        焦作|jiaozuo)                                   echo "jiaozuo" ;;
        濮阳|puyang)                                    echo "puyang" ;;
        许昌|xuchang)                                   echo "xuchang" ;;
        漯河|luohe)                                     echo "luohe" ;;
        三门峡|sanmenxia)                               echo "sanmenxia" ;;
        南阳|nanyang)                                   echo "nanyang" ;;
        商丘|shangqiu)                                  echo "shangqiu" ;;
        信阳|xinyang)                                   echo "xinyang" ;;
        周口|zhoukou)                                   echo "zhoukou" ;;
        驻马店|zhumadian)                               echo "zhumadian" ;;
        济源|jiyuan)                                    echo "jiyuan" ;;
        # ===== 湖北 =====
        武汉|wuhan)                                     echo "wuhan" ;;
        黄石|huangshi)                                  echo "huangshi" ;;
        十堰|shiyan)                                    echo "shiyan" ;;
        宜昌|yichang)                                   echo "yichang" ;;
        襄阳|xiangyang)                                 echo "xiangyang" ;;
        鄂州|ezhou)                                     echo "ezhou" ;;
        荆门|jingmen)                                   echo "jingmen" ;;
        孝感|xiaogan)                                   echo "xiaogan" ;;
        荆州|jingzhou)                                  echo "jingzhou" ;;
        黄冈|huanggang)                                 echo "huanggang" ;;
        咸宁|xianning)                                  echo "xianning" ;;
        随州|suizhou)                                   echo "suizhou" ;;
        恩施州|恩施|enshi)                              echo "enshi" ;;
        # ===== 湖南 =====
        长沙|changsha)                                  echo "changsha" ;;
        株洲|zhuzhou)                                   echo "zhuzhou" ;;
        湘潭|xiangtan)                                  echo "xiangtan" ;;
        衡阳|hengyang)                                  echo "hengyang" ;;
        邵阳|shaoyang)                                  echo "shaoyang" ;;
        岳阳|yueyang)                                   echo "yueyang" ;;
        常德|changde)                                   echo "changde" ;;
        张家界|zhangjiajie)                             echo "zhangjiajie" ;;
        益阳|yiyang)                                    echo "yiyang" ;;
        郴州|chenzhou)                                  echo "chenzhou" ;;
        永州|yongzhou)                                  echo "yongzhou" ;;
        怀化|huaihua)                                   echo "huaihua" ;;
        娄底|loudi)                                     echo "loudi" ;;
        湘西州|湘西|xiangxi)                            echo "xiangxi" ;;
        # ===== 广东 =====
        广州|guangzhou)                                 echo "guangzhou" ;;
        深圳|shenzhen)                                  echo "shenzhen" ;;
        珠海|zhuhai)                                    echo "zhuhai" ;;
        汕头|shantou)                                   echo "shantou" ;;
        佛山|foshan)                                    echo "foshan" ;;
        韶关|shaoguan)                                  echo "shaoguan" ;;
        湛江|zhanjiang)                                 echo "zhanjiang" ;;
        肇庆|zhaoqing)                                  echo "zhaoqing" ;;
        江门|jiangmen)                                  echo "jiangmen" ;;
        茂名|maoming)                                   echo "maoming" ;;
        惠州|huizhou)                                   echo "huizhou" ;;
        梅州|meizhou)                                   echo "meizhou" ;;
        汕尾|shanwei)                                   echo "shanwei" ;;
        河源|heyuan)                                    echo "heyuan" ;;
        阳江|yangjiang)                                 echo "yangjiang" ;;
        清远|qingyuan)                                  echo "qingyuan" ;;
        东莞|dongguan)                                  echo "dongguan" ;;
        中山|zhongshan)                                 echo "zhongshan" ;;
        潮州|chaozhou)                                  echo "chaozhou" ;;
        揭阳|jieyang)                                   echo "jieyang" ;;
        云浮|yunfu)                                     echo "yunfu" ;;
        # ===== 广西 =====
        南宁|nanning)                                   echo "nanning" ;;
        柳州|liuzhou)                                   echo "liuzhou" ;;
        桂林|guilin)                                    echo "guilin" ;;
        梧州|wuzhou)                                    echo "wuzhou" ;;
        北海|beihai)                                    echo "beihai" ;;
        防城港|fangchenggang)                           echo "fangchenggang" ;;
        钦州|qinzhou)                                   echo "qinzhou" ;;
        贵港|guigang)                                   echo "guigang" ;;
        # 注：玉林(yulin) 与陕西榆林拼音撞车，不收表
        百色|baise|bose)                                echo "baise" ;;
        贺州|hezhou)                                    echo "hezhou" ;;
        河池|hechi)                                     echo "hechi" ;;
        来宾|laibin)                                    echo "laibin" ;;
        崇左|chongzuo)                                  echo "chongzuo" ;;
        # ===== 海南 =====
        海口|haikou)                                    echo "haikou" ;;
        三亚|sanya)                                     echo "sanya" ;;
        三沙|sansha)                                    echo "sansha" ;;
        儋州|danzhou)                                   echo "danzhou" ;;
        # ===== 四川 =====
        成都|chengdu)                                   echo "chengdu" ;;
        自贡|zigong)                                    echo "zigong" ;;
        攀枝花|panzhihua)                               echo "panzhihua" ;;
        泸州|luzhou)                                    echo "luzhou" ;;
        德阳|deyang)                                    echo "deyang" ;;
        绵阳|mianyang)                                  echo "mianyang" ;;
        广元|guangyuan)                                 echo "guangyuan" ;;
        遂宁|suining)                                   echo "suining" ;;
        内江|neijiang)                                  echo "neijiang" ;;
        乐山|leshan)                                    echo "leshan" ;;
        南充|nanchong)                                  echo "nanchong" ;;
        眉山|meishan)                                   echo "meishan" ;;
        宜宾|yibin)                                     echo "yibin" ;;
        广安|guangan)                                   echo "guangan" ;;
        达州|dazhou)                                    echo "dazhou" ;;
        雅安|yaan)                                      echo "yaan" ;;
        巴中|bazhong)                                   echo "bazhong" ;;
        资阳|ziyang)                                    echo "ziyang" ;;
        阿坝州|阿坝|aba)                                echo "aba" ;;
        甘孜州|甘孜|ganzi)                              echo "ganzi" ;;
        凉山州|凉山|liangshan)                          echo "liangshan" ;;
        # ===== 贵州 =====
        贵阳|guiyang)                                   echo "guiyang" ;;
        六盘水|liupanshui)                              echo "liupanshui" ;;
        遵义|zunyi)                                     echo "zunyi" ;;
        安顺|anshun)                                    echo "anshun" ;;
        毕节|bijie)                                     echo "bijie" ;;
        铜仁|tongren)                                   echo "tongren" ;;
        黔西南州|黔西南|qianxinan)                      echo "qianxinan" ;;
        黔东南州|黔东南|qiandongnan)                    echo "qiandongnan" ;;
        黔南州|黔南|qiannan)                            echo "qiannan" ;;
        # ===== 云南 =====
        昆明|kunming)                                   echo "kunming" ;;
        曲靖|qujing)                                    echo "qujing" ;;
        玉溪|yuxi)                                      echo "yuxi" ;;
        保山|baoshan)                                   echo "baoshan" ;;
        昭通|zhaotong)                                  echo "zhaotong" ;;
        丽江|lijiang)                                   echo "lijiang" ;;
        普洱|puer|puerh)                                echo "puer" ;;
        临沧|lincang)                                   echo "lincang" ;;
        楚雄州|楚雄|chuxiong)                           echo "chuxiong" ;;
        红河州|红河|honghe)                             echo "honghe" ;;
        文山州|文山|wenshan)                            echo "wenshan" ;;
        西双版纳|xishuangbanna)                         echo "xishuangbanna" ;;
        大理州|大理|dali)                               echo "dali" ;;
        德宏州|德宏|dehong)                             echo "dehong" ;;
        怒江州|怒江|nujiang)                            echo "nujiang" ;;
        迪庆州|迪庆|diqing)                             echo "diqing" ;;
        # ===== 西藏 =====
        拉萨|lasa|lhasa)                                echo "lhasa" ;;
        日喀则|rikaze|shigatse)                         echo "rikaze" ;;
        昌都|changdu|qamdo)                             echo "changdu" ;;
        林芝|linzhi|nyingchi)                           echo "linzhi" ;;
        山南|shannan)                                   echo "shannan" ;;
        那曲|naqu|nagqu)                                echo "naqu" ;;
        阿里地区|阿里|ali|ngari)                        echo "ali" ;;
        # ===== 陕西 =====
        西安|xian)                                      echo "xian" ;;
        铜川|tongchuan)                                 echo "tongchuan" ;;
        宝鸡|baoji)                                     echo "baoji" ;;
        咸阳|xianyang)                                  echo "xianyang" ;;
        渭南|weinan)                                    echo "weinan" ;;
        延安|yanan)                                     echo "yanan" ;;
        汉中|hanzhong)                                  echo "hanzhong" ;;
        榆林|yulin)                                     echo "yulin" ;;
        安康|ankang)                                    echo "ankang" ;;
        商洛|shangluo)                                  echo "shangluo" ;;
        # ===== 甘肃 =====
        兰州|lanzhou)                                   echo "lanzhou" ;;
        嘉峪关|jiayuguan)                               echo "jiayuguan" ;;
        金昌|jinchang)                                  echo "jinchang" ;;
        白银|baiyin)                                    echo "baiyin" ;;
        天水|tianshui)                                  echo "tianshui" ;;
        武威|wuwei)                                     echo "wuwei" ;;
        张掖|zhangye)                                   echo "zhangye" ;;
        平凉|pingliang)                                 echo "pingliang" ;;
        酒泉|jiuquan)                                   echo "jiuquan" ;;
        庆阳|qingyang)                                  echo "qingyang" ;;
        定西|dingxi)                                    echo "dingxi" ;;
        陇南|longnan)                                   echo "longnan" ;;
        临夏州|临夏|linxia)                             echo "linxia" ;;
        甘南州|甘南|gannan)                             echo "gannan" ;;
        # ===== 青海 =====
        西宁|xining)                                    echo "xining" ;;
        海东|haidong)                                   echo "haidong" ;;
        海北州|海北|haibei)                             echo "haibei" ;;
        黄南州|黄南|huangnan)                           echo "huangnan" ;;
        海南州|海南|hainan)                             echo "hainan" ;;
        果洛州|果洛|guoluo)                             echo "guoluo" ;;
        玉树州|玉树|yushu)                              echo "yushu" ;;
        海西州|海西|haixi)                              echo "haixi" ;;
        # ===== 宁夏 =====
        银川|yinchuan)                                  echo "yinchuan" ;;
        石嘴山|shizuishan)                              echo "shizuishan" ;;
        吴忠|wuzhong)                                   echo "wuzhong" ;;
        固原|guyuan)                                    echo "guyuan" ;;
        中卫|zhongwei)                                  echo "zhongwei" ;;
        # ===== 新疆 =====
        乌鲁木齐|wulumuqi|urumqi)                       echo "urumqi" ;;
        克拉玛依|kelamayi|karamay)                      echo "karamay" ;;
        吐鲁番|tulufan|turpan)                          echo "turpan" ;;
        哈密|hami|kumul)                                echo "hami" ;;
        昌吉州|昌吉|changji)                            echo "changji" ;;
        博尔塔拉州|博尔塔拉|bortala)                    echo "bortala" ;;
        巴音郭楞州|巴音郭楞|bayinguoleng)               echo "bayinguoleng" ;;
        阿克苏|akesu|aksu)                              echo "aksu" ;;
        克孜勒苏州|克孜勒苏|kezilesu)                   echo "kezilesu" ;;
        喀什|kashi|kashgar)                             echo "kashi" ;;
        和田|hetian|hotan)                              echo "hetian" ;;
        伊犁州|伊犁|yili)                               echo "yili" ;;
        塔城地区|塔城|tacheng)                          echo "tacheng" ;;
        阿勒泰地区|阿勒泰|aletai|altay)                 echo "aletai" ;;
        # ===== 港澳台 =====
        香港|hongkong|xianggang)                        echo "hongkong" ;;
        澳门|macau|macao|aomen)                         echo "macau" ;;
        台北|taipei)                                    echo "taipei" ;;
        高雄|kaohsiung)                                 echo "kaohsiung" ;;
        台中|taichung)                                  echo "taichung" ;;
        台南|tainan)                                    echo "tainan" ;;
        新北|xinbei|newtaipei)                          echo "xinbei" ;;
        桃园|taoyuan)                                   echo "taoyuan" ;;
        基隆|jilong|keelung)                            echo "jilong" ;;
        新竹|xinzhu)                                    echo "xinzhu" ;;
        嘉义|jiayi)                                     echo "jiayi" ;;
        # ===== 省直管县 / 热门县级市 =====
        仙桃|xiantao)                                   echo "xiantao" ;;
        潜江|qianjiang)                                 echo "qianjiang" ;;
        天门|tianmen)                                   echo "tianmen" ;;
        神农架|shennongjia)                             echo "shennongjia" ;;
        昆山|kunshan)                                   echo "kunshan" ;;
        常熟|changshu)                                  echo "changshu" ;;
        张家港|zhangjiagang)                            echo "zhangjiagang" ;;
        江阴|jiangyin)                                  echo "jiangyin" ;;
        宜兴|yixing)                                    echo "yixing" ;;
        溧阳|liyang)                                    echo "liyang" ;;
        义乌|yiwu)                                      echo "yiwu" ;;
        慈溪|cixi)                                      echo "cixi" ;;
        诸暨|zhuji)                                     echo "zhuji" ;;
        余姚|yuyao)                                     echo "yuyao" ;;
        温岭|wenling)                                   echo "wenling" ;;
        瑞安|ruian)                                     echo "ruian" ;;
        乐清|yueqing)                                   echo "yueqing" ;;
        晋江|jinjiang)                                  echo "jinjiang" ;;
        南安|nanan)                                     echo "nanan" ;;
        福清|fuqing)                                    echo "fuqing" ;;
        龙口|longkou)                                   echo "longkou" ;;
        荣成|rongcheng)                                 echo "rongcheng" ;;
        滕州|tengzhou)                                  echo "tengzhou" ;;
        寿光|shouguang)                                 echo "shouguang" ;;
        高密|gaomi)                                     echo "gaomi" ;;
        诸城|zhucheng)                                  echo "zhucheng" ;;
        浏阳|liuyang)                                   echo "liuyang" ;;
        宁乡|ningxiang)                                 echo "ningxiang" ;;
        醴陵|liling)                                    echo "liling" ;;
        都江堰|dujiangyan)                              echo "dujiangyan" ;;
        彭州|pengzhou)                                  echo "pengzhou" ;;
        崇州|chongzhou)                                 echo "chongzhou" ;;
        邛崃|qionglai)                                  echo "qionglai" ;;
        什邡|shifang)                                   echo "shifang" ;;
        广汉|guanghan)                                  echo "guanghan" ;;
        峨眉山|emeishan)                                echo "emeishan" ;;
        阆中|langzhong)                                 echo "langzhong" ;;
        满洲里|manzhouli)                               echo "manzhouli" ;;
        二连浩特|erlianhaote|erenhot)                   echo "erenhot" ;;
        绥芬河|suifenhe)                                echo "suifenhe" ;;
        珲春|hunchun)                                   echo "hunchun" ;;
        敦煌|dunhuang)                                  echo "dunhuang" ;;
        格尔木|geermu|golmud)                           echo "geermu" ;;
        九寨沟|jiuzhaigou)                              echo "jiuzhaigou" ;;
        香格里拉|xianggelila|shangrila)                 echo "shangrila" ;;
    esac
}

# 城市名归一化
# 参数: $1=城市名（中文 / 拼音 / 英文均可，可带"市/县/区/省"后缀）
# 输出: 归一化 slug（小写、空格转 "-"）；表中未收录的城市原样返回
# 用法: slug=$(normalize_city_slug "深圳市")   # → shenzhen
normalize_city_slug() {
    local city="${1:-}"
    if [ -z "${city}" ]; then
        printf ''
        return 0
    fi

    # 1+2. 去首尾空白 + 转小写 + 空格/下划线转 "-"
    city=$(printf '%s' "${city}" \
        | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' \
        | tr '[:upper:]' '[:lower:]' | tr ' _' '--')

    # 3. 去行政后缀：深圳市 → 深圳（避免"市"字导致多一份缓存）
    city=$(printf '%s' "${city}" | sed -e 's/市$//' -e 's/县$//' -e 's/区$//' -e 's/省$//')

    # 4. 中文 ↔ 拼音映射；未命中则原样返回
    local slug
    slug=$(_city_slug_lookup "${city}")
    printf '%s' "${slug:-${city}}"
}
