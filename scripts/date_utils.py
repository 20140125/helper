#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
统一日期管理模块
功能：
1. 农历公历互转
2. 工作日计算
3. 节假日判断
4. 生日提醒
5. 节气查询

使用lunar_python + calendar模块实现完整的日期管理功能
"""

from __future__ import annotations

import calendar
import json
import sys
from datetime import datetime, timedelta
from typing import Optional  # pyright: ignore[reportDeprecated]

from lunar_python import Lunar, Solar  # pyright: ignore[reportMissingTypeStubs]


class DateManager:
    """统一日期管理器"""
    
    holidays: dict[str, list[str]]
    
    def __init__(self, holidays_config: Optional[dict[str, list[str]]] = None) -> None:  # pyright: ignore[reportDeprecated]
        """初始化
        
        Args:
            holidays_config: 节假日配置字典
                格式: {
                    'holidays': ['2026-01-01', '2026-01-02', ...],  # 法定节假日
                    'workdays': ['2026-01-26', '2026-02-08', ...]   # 调休工作日
                }
        """
        self.holidays = holidays_config or {}
    
    # =================================================
    # 农历相关
    # =================================================
    
    def lunar_to_solar(self, year: int, month: int, day: int, leap_month: bool = False) -> datetime:
        """农历转公历
        
        Args:
            year: 农历年份
            month: 农历月份
            day: 农历日期
            leap_month: 是否闰月（默认False，暂不支持）
            
        Returns:
            datetime对象
        """
        _ = leap_month  # 预留参数，暂不使用
        try:
            lunar = Lunar.fromYmd(year, month, day)  # pyright: ignore[reportUnknownMemberType]
            solar = lunar.getSolar()
            return datetime(solar.getYear(), solar.getMonth(), solar.getDay())  # pyright: ignore[reportUnknownArgumentType]
        except Exception as e:
            raise ValueError(f"农历转公历失败: {year}年{month}月{day}日, 错误: {e}")
    
    def solar_to_lunar(self, date: datetime) -> dict[str, int | str]:
        """公历转农历
        
        Args:
            date: datetime对象
            
        Returns:
            dict: {
                'year': 农历年份,
                'month': 农历月份,
                'day': 农历日期,
                'lunar_str': '腊月初八'格式的中文字符串,
                'gan_zhi_year': 干支年（如'丙午年'）,
                'zodiac': 生肖（如'马'）
            }
        """
        try:
            solar = Solar.fromDate(date)  # pyright: ignore[reportUnknownMemberType]
            lunar = solar.getLunar()
            
            return {
                'year': int(lunar.getYear()),
                'month': int(lunar.getMonth()),
                'day': int(lunar.getDay()),
                'lunar_str': str(f"{lunar.getMonthInChinese()}月{lunar.getDayInChinese()}"),
                'gan_zhi_year': str(lunar.getYearInGanZhi()),
                'zodiac': str(lunar.getYearShengXiao())
            }
        except Exception as e:
            raise ValueError(f"公历转农历失败: {date}, 错误: {e}")
    
    def get_lunar_birthday_this_year(self, lunar_month: int, lunar_day: int) -> datetime:
        """获取今年农历生日对应的公历日期
        
        Args:
            lunar_month: 农历月份
            lunar_day: 农历日期
            
        Returns:
            datetime对象
        """
        current_year = datetime.now().year
        try:
            return self.lunar_to_solar(current_year, lunar_month, lunar_day)
        except:
            # 如果今年转换失败（比如今年没有该闰月），尝试下一年
            return self.lunar_to_solar(current_year + 1, lunar_month, lunar_day)
    
    def get_lunar_birthday_next_occurrence(self, lunar_month: int, lunar_day: int) -> datetime:
        """获取农历生日的下一次出现日期（可能是今年或明年）
        
        Args:
            lunar_month: 农历月份
            lunar_day: 农历日期
            
        Returns:
            datetime对象
        """
        today = datetime.now()
        current_year = today.year
        
        try:
            # 尝试今年
            this_year_birthday = self.lunar_to_solar(current_year, lunar_month, lunar_day)
            if this_year_birthday >= today:
                return this_year_birthday
        except:
            pass
        
        # 今年不行或已过，返回明年
        return self.lunar_to_solar(current_year + 1, lunar_month, lunar_day)
    
    # =================================================
    # 工作日相关
    # =================================================
    
    def is_workday(self, date: datetime) -> bool:
        """判断是否为工作日
        
        Args:
            date: datetime对象
            
        Returns:
            bool: True表示工作日，False表示非工作日
        """
        date_str = date.strftime('%Y-%m-%d')
        
        # 先检查是否为调休工作日（优先级最高）
        if date_str in self.holidays.get('workdays', []):
            return True
        
        # 检查是否为法定节假日
        if date_str in self.holidays.get('holidays', []):
            return False
        
        # 检查是否为周末
        if date.weekday() >= 5:  # 5=Saturday, 6=Sunday
            return False
        
        return True
    
    def is_weekend(self, date: datetime) -> bool:
        """判断是否为周末"""
        return date.weekday() >= 5
    
    def is_holiday(self, date: datetime) -> bool:
        """判断是否为法定节假日"""
        date_str = date.strftime('%Y-%m-%d')
        return date_str in self.holidays.get('holidays', [])
    
    def count_workdays(self, start_date: datetime, end_date: datetime) -> int:
        """计算日期范围内的工作日数量
        
        Args:
            start_date: 开始日期（datetime对象）
            end_date: 结束日期（datetime对象）
            
        Returns:
            int: 工作日数量
        """
        count = 0
        current = start_date
        while current <= end_date:
            if self.is_workday(current):
                count += 1
            current += timedelta(days=1)
        return count
    
    def next_workday(self, date: datetime) -> datetime:
        """获取下一个工作日
        
        Args:
            date: datetime对象
            
        Returns:
            datetime对象
        """
        next_day = date + timedelta(days=1)
        while not self.is_workday(next_day):
            next_day += timedelta(days=1)
        return next_day
    
    def previous_workday(self, date: datetime) -> datetime:
        """获取上一个工作日"""
        prev_day = date - timedelta(days=1)
        while not self.is_workday(prev_day):
            prev_day -= timedelta(days=1)
        return prev_day
    
    def get_workdays_in_month(self, year: int, month: int) -> list[datetime]:
        """获取指定月份的所有工作日
        
        Args:
            year: 年份
            month: 月份
            
        Returns:
            list: 工作日列表（datetime对象）
        """
        workdays = []
        cal = calendar.monthcalendar(year, month)
        for week in cal:
            for day in week:
                if day != 0:  # 0表示不属于当月
                    date = datetime(year, month, day)
                    if self.is_workday(date):
                        workdays.append(date)  # pyright: ignore[reportUnknownMemberType]
        return workdays  # pyright: ignore[reportUnknownVariableType]
    
    # =================================================
    # 生日相关
    # =================================================
    
    def calculate_age(self, birth_date: datetime, reference_date: Optional[datetime] = None) -> int:  # pyright: ignore[reportDeprecated]
        """计算年龄
        
        Args:
            birth_date: 出生日期（datetime对象）
            reference_date: 参考日期（默认为今天）
            
        Returns:
            int: 周岁年龄
        """
        if reference_date is None:
            reference_date = datetime.now()
        
        age = reference_date.year - birth_date.year
        
        # 如果今年的生日还没到，年龄减1
        if (reference_date.month, reference_date.day) < (birth_date.month, birth_date.day):
            age -= 1
        
        return age
    
    def days_until_birthday(self, month: int, day: int, reference_date: Optional[datetime] = None) -> int:  # pyright: ignore[reportDeprecated]
        """计算距离生日还有多少天
        
        Args:
            month: 生日月份
            day: 生日日期
            reference_date: 参考日期（默认为今天）
            
        Returns:
            int: 剩余天数
        """
        if reference_date is None:
            reference_date = datetime.now()
        
        this_year_birthday = datetime(reference_date.year, month, day)
        
        if this_year_birthday < reference_date:
            next_birthday = datetime(reference_date.year + 1, month, day)
        else:
            next_birthday = this_year_birthday
        
        return (next_birthday - reference_date).days
    
    def days_until_lunar_birthday(self, lunar_month: int, lunar_day: int) -> int:
        """计算距离农历生日还有多少天"""
        today = datetime.now()
        next_birthday = self.get_lunar_birthday_next_occurrence(lunar_month, lunar_day)
        return (next_birthday - today).days
    
    # =================================================
    # 节气相关
    # =================================================
    
    def get_solar_term(self, date: datetime) -> Optional[str]:  # pyright: ignore[reportDeprecated]
        """获取指定日期的节气
        
        Args:
            date: datetime对象
            
        Returns:
            str: 节气名称（如果当天是节气），否则返回None
        """
        try:
            solar = Solar.fromDate(date)  # pyright: ignore[reportUnknownMemberType]
            lunar = solar.getLunar()
            jie_qi = lunar.getJieQi()  # pyright: ignore[reportUnknownVariableType]
            return jie_qi if jie_qi else None  # pyright: ignore[reportUnknownVariableType]
        except:
            return None
    
    def get_next_solar_term(self, date: Optional[datetime] = None) -> Optional[dict[str, str | datetime]]:  # pyright: ignore[reportDeprecated]
        """获取下一个节气
        
        Args:
            date: 起始日期（默认为今天）
            
        Returns:
            dict: {'name': 节气名称, 'date': datetime对象}
        """
        if date is None:
            date = datetime.now()
        
        # 向后搜索，最多搜索20天（节气间隔约15天）
        for i in range(1, 21):
            check_date = date + timedelta(days=i)
            jie_qi = self.get_solar_term(check_date)
            if jie_qi:
                return {'name': jie_qi, 'date': check_date}
        
        return None
    
    # =================================================
    # 实用工具
    # =================================================
    
    def format_chinese_date(self, date: datetime) -> str:
        """格式化为中文日期
        
        Args:
            date: datetime对象
            
        Returns:
            str: 中文日期格式，如"2026年2月6日（腊月初八）"
        """
        lunar_info = self.solar_to_lunar(date)
        return f"{date.year}年{date.month}月{date.day}日（{lunar_info['lunar_str']}）"
    
    def parse_date_string(self, date_str: str) -> dict[str, str | int | bool | datetime]:
        """解析日期字符串
        
        支持格式：
        - 'YYYY-MM-DD': 公历
        - 'MM-DD': 公历（当年）
        - 'lunar:MM-DD': 农历（当年）
        - 'lunar:YYYY-MM-DD': 农历（指定年份）
        
        Args:
            date_str: 日期字符串
            
        Returns:
            dict: {'type': 'solar'/'lunar', 'date': datetime对象或(year, month, day)元组}
        """
        date_str = date_str.strip()
        
        # 农历格式
        if date_str.startswith('lunar:'):
            lunar_part = date_str[6:]  # 去掉'lunar:'前缀
            
            if '-' in lunar_part:
                parts = lunar_part.split('-')
                if len(parts) == 2:
                    # lunar:MM-DD（当年）
                    month, day = int(parts[0]), int(parts[1])
                    return {
                        'type': 'lunar',
                        'month': month,
                        'day': day,
                        'use_current_year': True
                    }
                elif len(parts) == 3:
                    # lunar:YYYY-MM-DD
                    year, month, day = int(parts[0]), int(parts[1]), int(parts[2])
                    return {
                        'type': 'lunar',
                        'year': year,
                        'month': month,
                        'day': day,
                        'use_current_year': False
                    }
        
        # 公历格式
        else:
            if '-' in date_str:
                parts = date_str.split('-')
                if len(parts) == 2:
                    # MM-DD（当年）
                    month, day = int(parts[0]), int(parts[1])
                    year = datetime.now().year
                    return {
                        'type': 'solar',
                        'date': datetime(year, month, day)
                    }
                elif len(parts) == 3:
                    # YYYY-MM-DD
                    year, month, day = int(parts[0]), int(parts[1]), int(parts[2])
                    return {
                        'type': 'solar',
                        'date': datetime(year, month, day)
                    }
        
        raise ValueError(f"无法解析日期字符串: {date_str}")


# =================================================
# 命令行工具函数
# =================================================

def cli_lunar_to_solar(year: str, month: str, day: str) -> None:
    """命令行工具：农历转公历"""
    dm = DateManager()
    try:
        result = dm.lunar_to_solar(int(year), int(month), int(day))
        print(result.strftime('%Y-%m-%d'))
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)

def cli_solar_to_lunar(date_str: str) -> None:
    """命令行工具：公历转农历"""
    dm = DateManager()
    try:
        date = datetime.strptime(date_str, '%Y-%m-%d')
        result = dm.solar_to_lunar(date)
        print(f"{result['year']}-{result['month']:02d}-{result['day']:02d} ({result['lunar_str']})")
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)

def cli_lunar_birthday_this_year(month: str, day: str) -> None:
    """命令行工具：获取今年农历生日的公历日期"""
    dm = DateManager()
    try:
        result = dm.get_lunar_birthday_this_year(int(month), int(day))
        print(result.strftime('%Y-%m-%d'))
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)


# =================================================
# 使用示例和测试
# =================================================

if __name__ == "__main__":
    import sys
    
    # 如果有命令行参数，作为CLI工具运行
    if len(sys.argv) > 1:
        command = sys.argv[1]
        
        if command == "lunar2solar" and len(sys.argv) == 5:
            # python date_utils.py lunar2solar 2027 10 16
            cli_lunar_to_solar(sys.argv[2], sys.argv[3], sys.argv[4])
        
        elif command == "solar2lunar" and len(sys.argv) == 3:
            # python date_utils.py solar2lunar 2027-11-23
            cli_solar_to_lunar(sys.argv[2])
        
        elif command == "birthday" and len(sys.argv) == 4:
            # python date_utils.py birthday 10 16
            cli_lunar_birthday_this_year(sys.argv[2], sys.argv[3])
        
        elif command == "days_until" and len(sys.argv) == 4:
            # python date_utils.py days_until 10 16
            # 计算距离公历生日还有多少天
            dm = DateManager()
            days = dm.days_until_birthday(int(sys.argv[2]), int(sys.argv[3]))
            print(days)
        
        elif command == "days_until_lunar" and len(sys.argv) == 4:
            # python date_utils.py days_until_lunar 10 16
            # 计算距离农历生日还有多少天
            dm = DateManager()
            days = dm.days_until_lunar_birthday(int(sys.argv[2]), int(sys.argv[3]))
            print(days)
        
        elif command == "lunar_festivals" and len(sys.argv) == 3:
            # python date_utils.py lunar_festivals '<JSON>'
            # 批量转换农历节日为当年公历日期
            # 输入 JSON: {"12-08":"腊八节","12-23":"小年",...}
            # 输出: 每行 MM-DD|节日名  (按公历日期排序)
            #
            # 跨年处理：
            #   农历12月（腊月）的节日在公历年初发生，
            #   对应的是「上一年」的农历十二月，
            #   所以用 current_year - 1 进行转换。
            dm = DateManager()
            festivals = json.loads(sys.argv[2])  # pyright: ignore[reportAny]
            current_year = datetime.now().year
            results: list[tuple[str, str]] = []
            
            for lunar_md, name in festivals.items():  # pyright: ignore[reportAny]
                lunar_month_str, lunar_day_str = lunar_md.split('-')  # pyright: ignore[reportAny]
                lunar_month = int(lunar_month_str)  # pyright: ignore[reportAny]
                lunar_day = int(lunar_day_str)  # pyright: ignore[reportAny]
                
                # 确定用哪个农历年转换
                # 农历12月（腊月）的节日 → 用上一年农历
                # 其他月份 → 用当年农历
                lunar_year = current_year - 1 if lunar_month >= 12 else current_year
                
                try:
                    # 特殊处理除夕：腊月可能是29或30天
                    if name == "除夕":
                        try:
                            solar = dm.lunar_to_solar(lunar_year, lunar_month, lunar_day)
                        except ValueError:
                            solar = dm.lunar_to_solar(lunar_year, lunar_month, 29)
                    else:
                        solar = dm.lunar_to_solar(lunar_year, lunar_month, lunar_day)
                    
                    mmdd = solar.strftime('%m-%d')
                    results.append((mmdd, name))
                except Exception as e:
                    print(f"ERROR:{name}:{e}", file=sys.stderr)
            
            # 按公历日期排序输出
            for mmdd, name in sorted(results, key=lambda x: x[0]):
                print(f"{mmdd}|{name}")
        
        elif command == "solar_term":
            # python date_utils.py solar_term [YYYY-MM-DD]
            # 查询指定日期（默认今天）是否为节气
            # 如果是节气，输出节气名称；否则无输出，exit 1
            dm = DateManager()
            date_str = sys.argv[2] if len(sys.argv) >= 3 else None
            date = datetime.strptime(date_str, '%Y-%m-%d') if date_str else datetime.now()
            term = dm.get_solar_term(date)
            if term:
                print(term)
            else:
                sys.exit(1)
        
        else:
            print("用法:")
            print("  python date_utils.py lunar2solar YEAR MONTH DAY")
            print("  python date_utils.py solar2lunar YYYY-MM-DD")
            print("  python date_utils.py birthday MONTH DAY")
            print("  python date_utils.py days_until MONTH DAY")
            print("  python date_utils.py days_until_lunar MONTH DAY")
            print("  python date_utils.py lunar_festivals '<JSON>'")
            print("  python date_utils.py solar_term [YYYY-MM-DD]")
            sys.exit(1)
    
    # 否则运行测试
    else:
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print("🧪 DateManager 功能测试")
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        
        # 初始化
        dm = DateManager()
        
        # 测试1: 农历转公历
        print("\n【测试1: 农历转公历】")
        birthday = dm.lunar_to_solar(2027, 10, 16)
        print(f"✅ 2027年农历10月16日 = {birthday.strftime('%Y-%m-%d')}")
        
        # 测试2: 公历转农历
        print("\n【测试2: 公历转农历】")
        today = datetime.now()
        lunar_today = dm.solar_to_lunar(today)
        print(f"✅ 今天: {dm.format_chinese_date(today)}")
        print(f"   干支: {lunar_today['gan_zhi_year']} 生肖: {lunar_today['zodiac']}")
        
        # 测试3: 农历生日提醒
        print("\n【测试3: 农历生日提醒】")
        next_birthday = dm.get_lunar_birthday_this_year(10, 16)
        print(f"✅ 今年农历10月16日生日: {next_birthday.strftime('%Y-%m-%d')}")
        days = dm.days_until_lunar_birthday(10, 16)
        print(f"   距离生日还有 {days} 天")
        
        # 测试4: 节气查询
        print("\n【测试4: 节气查询】")
        jie_qi = dm.get_solar_term(today)
        if jie_qi:
            print(f"✅ 今天是节气: {jie_qi}")
        else:
            print(f"✅ 今天不是节气")
            next_jq = dm.get_next_solar_term()
            if next_jq:
                next_jq_date = next_jq['date']
                assert isinstance(next_jq_date, datetime)
                print(f"   下一个节气: {next_jq['name']} ({next_jq_date.strftime('%Y-%m-%d')})")
        
        # 测试5: 日期字符串解析
        print("\n【测试5: 日期字符串解析】")
        test_strings = ["2026-11-24", "11-24", "lunar:10-16"]
        for s in test_strings:
            parsed = dm.parse_date_string(s)
            print(f"✅ '{s}' -> {parsed}")
        
        print("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print("✅ 所有测试通过！")
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
