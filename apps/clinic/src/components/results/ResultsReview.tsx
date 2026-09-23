import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
type Props = { onBack?: () => void };
const C = { primary:'#1E3A8A', teal:'#0D9488', bg:'#F0F9FF', card:'#FFF', text:'#0F172A', muted:'#64748B' };
const RESULTS = [
  { id:'1', type:'Lab', name:'Troponin-I', value:'0.84 ng/mL', flag:'CRITICAL', patient:'Robert Chen', bed:'4B', time:'11:18', ack:false },
  { id:'2', type:'Lab', name:'BNP', value:'842 pg/mL', flag:'HIGH', patient:'Margaret Taylor', bed:'5A', time:'09:55', ack:true },
  { id:'3', type:'Imaging', name:'Portable CXR', value:'Mild pulmonary congestion', flag:'', patient:'Margaret Taylor', bed:'5A', time:'08:40', ack:true },
  { id:'4', type:'Lab', name:'K+', value:'3.1 mmol/L', flag:'LOW', patient:'Aisha Okonkwo', bed:'6C', time:'07:30', ack:false },
  { id:'5', type:'Imaging', name:'12-lead ECG', value:'Sinus tach, no acute ST changes', flag:'', patient:'Robert Chen', bed:'4B', time:'11:28', ack:false },
];
export const ResultsReview: React.FC<Props> = ({ onBack }) => {
  const [filter, setFilter] = useState<'pending'|'all'>('pending');
  const list = RESULTS.filter(r => filter==='pending' ? !r.ack : true);
  return (
    <ScrollView style={s.wrap} showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom:28}}>
      {onBack && <TouchableOpacity onPress={onBack} style={{marginBottom:10}}><Text style={s.back}>← Back</Text></TouchableOpacity>}
      <Text style={s.pageTitle}>Results Review</Text><Text style={s.pageSub}>Lab & Imaging · Acknowledge critical results</Text>
      <View style={s.filters}>{(['pending','all'] as const).map(f=>(
        <TouchableOpacity key={f} style={[s.filterBtn, filter===f && s.filterOn]} onPress={()=>setFilter(f)}>
          <Text style={[s.filterText, filter===f && s.filterTextOn]}>{f==='pending'?'Pending Ack':'All Results'}</Text>
        </TouchableOpacity>
      ))}</View>
      {list.map(r=>(
        <View key={r.id} style={[s.card, r.flag==='CRITICAL' && s.critical]}>
          <View style={s.top}>
            <View style={[s.typeBadge, r.type==='Lab'?s.lab:s.img]}><Text style={s.typeText}>{r.type}</Text></View>
            {!!r.flag && <View style={[s.flag, r.flag==='CRITICAL'?s.flagCrit:r.flag==='HIGH'?s.flagHigh:s.flagLow]}><Text style={s.flagText}>{r.flag}</Text></View>}
          </View>
          <Text style={s.name}>{r.name}</Text>
          <Text style={s.value}>{r.value}</Text>
          <Text style={s.meta}>{r.patient} · Bed {r.bed} · {r.time}</Text>
          {!r.ack ? <TouchableOpacity style={s.ackBtn}><Text style={s.ackText}>Acknowledge</Text></TouchableOpacity> : <Text style={s.acked}>✓ Acknowledged</Text>}
        </View>
      ))}
    </ScrollView>
  );
};
const s = StyleSheet.create({
  wrap:{flex:1,backgroundColor:C.bg,paddingHorizontal:16,paddingTop:16}, back:{fontSize:14,color:C.teal,fontWeight:'600'},
  pageTitle:{fontSize:20,fontWeight:'800',color:C.text}, pageSub:{fontSize:13,color:C.muted,marginBottom:14,marginTop:2},
  filters:{flexDirection:'row',gap:8,marginBottom:16}, filterBtn:{paddingHorizontal:14,paddingVertical:7,borderRadius:20,backgroundColor:'#E2E8F0'}, filterOn:{backgroundColor:C.primary},
  filterText:{fontSize:13,fontWeight:'600',color:'#475569'}, filterTextOn:{color:'#FFF'},
  card:{backgroundColor:C.card,borderRadius:16,padding:14,marginBottom:10,shadowColor:'#0F172A',shadowOpacity:0.05,shadowRadius:8,shadowOffset:{width:0,height:2},elevation:2},
  critical:{borderWidth:1,borderColor:'#FECACA'}, top:{flexDirection:'row',justifyContent:'space-between',marginBottom:6},
  typeBadge:{paddingHorizontal:8,paddingVertical:3,borderRadius:6}, lab:{backgroundColor:'#DBEAFE'}, img:{backgroundColor:'#EDE9FE'}, typeText:{fontSize:11,fontWeight:'700',color:C.text},
  flag:{paddingHorizontal:8,paddingVertical:3,borderRadius:6}, flagCrit:{backgroundColor:'#FEE2E2'}, flagHigh:{backgroundColor:'#FEF3C7'}, flagLow:{backgroundColor:'#E0F2FE'},
  flagText:{fontSize:10,fontWeight:'800',color:C.text}, name:{fontSize:15,fontWeight:'700',color:C.text}, value:{fontSize:16,fontWeight:'600',color:'#334155',marginTop:2},
  meta:{fontSize:12,color:C.muted,marginTop:4}, ackBtn:{marginTop:10,backgroundColor:C.primary,borderRadius:10,paddingVertical:10,alignItems:'center'},
  ackText:{color:'#FFF',fontWeight:'700',fontSize:13}, acked:{marginTop:8,fontSize:12,color:'#059669',fontWeight:'600'},
});
