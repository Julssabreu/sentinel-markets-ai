#property strict
#property version   "1.00"
#property description "Sentinel read-only bridge for Atomic Analyst MT5"

input string InpIndicatorPath = "Market\\Atomic Analyst MT5";
input int    InpBuyBuffer     = 11;
input int    InpSellBuffer    = 12;
input bool   InpClosedBarOnly = true;
input int    InpRefreshSeconds = 2;

int atomic_handle = INVALID_HANDLE;
datetime last_processed_bar = 0;
string status_file = "Sentinel\\AtomicMT5_Status.txt";
string signals_file = "Sentinel\\AtomicMT5_Signals.txt";

bool IsSignalValue(const double value)
{
   return MathIsValidNumber(value) && value != EMPTY_VALUE && value != 0.0;
}

string TimeframeName()
{
   string value = EnumToString((ENUM_TIMEFRAMES)_Period);
   StringReplace(value, "PERIOD_", "");
   return value;
}

void WriteStatus(const datetime bar_time,const double buy_value,const double sell_value,const int buy_copied,const int sell_copied)
{
   int file = FileOpen(status_file,FILE_COMMON|FILE_WRITE|FILE_TXT|FILE_ANSI);
   if(file == INVALID_HANDLE) return;
   string line = "Version=1 | Symbol="+_Symbol+" | TF="+TimeframeName()+" | Bar="+TimeToString(bar_time,TIME_DATE|TIME_SECONDS)+
                 " | BuyBuffer="+IntegerToString(InpBuyBuffer)+" | BuyValue="+DoubleToString(buy_value,_Digits)+" | BuyCopied="+IntegerToString(buy_copied)+
                 " | SellBuffer="+IntegerToString(InpSellBuffer)+" | SellValue="+DoubleToString(sell_value,_Digits)+" | SellCopied="+IntegerToString(sell_copied)+
                 " | Updated="+TimeToString(TimeCurrent(),TIME_DATE|TIME_SECONDS)+" | Mode=READ_ONLY";
   FileWriteString(file,line+"\r\n");
   FileClose(file);
}

void AppendSignal(const string signal_type,const datetime bar_time,const double value)
{
   int file = FileOpen(signals_file,FILE_COMMON|FILE_READ|FILE_WRITE|FILE_TXT|FILE_ANSI);
   if(file == INVALID_HANDLE) return;
   FileSeek(file,0,SEEK_END);
   string id = _Symbol+"-"+TimeframeName()+"-"+IntegerToString((long)bar_time)+"-"+signal_type;
   string line = "ID="+id+" | Type="+signal_type+" | Symbol="+_Symbol+" | TF="+TimeframeName()+
                 " | Time="+TimeToString(bar_time,TIME_DATE|TIME_SECONDS)+" | Value="+DoubleToString(value,_Digits)+
                 " | BuyBuffer="+IntegerToString(InpBuyBuffer)+" | SellBuffer="+IntegerToString(InpSellBuffer)+" | Source=Atomic Analyst MT5";
   FileWriteString(file,line+"\r\n");
   FileClose(file);
}

void ReadAtomic()
{
   if(atomic_handle == INVALID_HANDLE) return;
   int shift = InpClosedBarOnly ? 1 : 0;
   datetime bar_time = iTime(_Symbol,_Period,shift);
   if(bar_time <= 0) return;
   double buy_values[1],sell_values[1];
   buy_values[0] = EMPTY_VALUE;
   sell_values[0] = EMPTY_VALUE;
   int buy_copied = CopyBuffer(atomic_handle,InpBuyBuffer,shift,1,buy_values);
   int sell_copied = CopyBuffer(atomic_handle,InpSellBuffer,shift,1,sell_values);
   WriteStatus(bar_time,buy_values[0],sell_values[0],buy_copied,sell_copied);
   if(bar_time == last_processed_bar) return;
   last_processed_bar = bar_time;
   bool buy_signal = buy_copied == 1 && IsSignalValue(buy_values[0]);
   bool sell_signal = sell_copied == 1 && IsSignalValue(sell_values[0]);
   if(buy_signal && !sell_signal) AppendSignal("BUY",bar_time,buy_values[0]);
   else if(sell_signal && !buy_signal) AppendSignal("SELL",bar_time,sell_values[0]);
   else if(buy_signal && sell_signal) AppendSignal("CONFLICT",bar_time,buy_values[0]);
}

int OnInit()
{
   atomic_handle = iCustom(_Symbol,_Period,InpIndicatorPath);
   if(atomic_handle == INVALID_HANDLE)
   {
      Print("Sentinel: unable to load Atomic Analyst MT5. Error ",GetLastError());
      return INIT_FAILED;
   }
   EventSetTimer(MathMax(1,InpRefreshSeconds));
   ReadAtomic();
   return INIT_SUCCEEDED;
}

void OnTimer() { ReadAtomic(); }
void OnTick()  { if(!InpClosedBarOnly) ReadAtomic(); }

void OnDeinit(const int reason)
{
   EventKillTimer();
   if(atomic_handle != INVALID_HANDLE) IndicatorRelease(atomic_handle);
}
