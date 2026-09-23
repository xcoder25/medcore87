import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
type Props = { onBack?: () => void };
const C = { primary:'#1E3A8A', teal:'#0D9488', bg:'#F0F9FF', card:'#FFF', text:'#0F172A', muted:'#64748B' };
const CASES = [
  { time:'08:00', patient:'James Okafor', procedure:'Coronary Angiography ± PCI', surgeon:'Dr. Bello', status:'In Progress', theatre:'OT-2' },
  { time:'10:30', patient:'Fatima Yusuf', procedure:'CABG × 3', surgeon:'Dr. Okonkwo', status:'Next', theatre:'OT-1' },
  { time:'13:00', patient:'Chinedu Eze', procedure:'AVR (Aortic Valve Replacement)', surgeon:'Dr. Bello', status:'Scheduled', theatre:'OT-1' },
  { time:'15:30', patient:'Grace Adeyemi', procedure:'Pacemaker Insertion', surgeon:'Dr. Nwosu', status:'Scheduled', theatre:'OT-3' },
];
export const TheatreList: React.FC<Props> = ({ onBack }) => (
  <ScrollView style={s.wrap} showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom:28}}>
    {onBack && <TouchableOpacity onPress={onBack} style={{marginBottom:10}}><Text style={s.back}>← Back</Text></TouchableOpacity>}
    <Text style={s.pageTitle}>Theatre List</Text><Text style={s.pageSub}>Today’s operating theatre cases</Text>
    {CASES.map((c,i)=>(
      <View key={i} style={s.card}>
        <View style={s.top}><Text style={s.time}>{c.time}</Text><View style={[s.status, c.status==='In Progress'?s.inProg:c.status==='Next'?s.next:s.sched]}><Text style={s.statusText}>{c.status}</Text></View></View>
        <Text style={s.patient}>{c.patient}</Text>
        <Text style={s.proc}>{c.procedure}</Text>
        <Text style={s.meta}>{c.surgeon} · {c.theatre}</Text>
      </View>
    ))}
    <TouchableOpacity style={s.btn}><Text style={s.btnText}>+ Request Theatre Slot</Text></TouchableOpacity>
  </ScrollView>
);
const s = StyleSheet.create({
  wrap:{flex:1,backgroundColor:C.bg,paddingHorizontal:16,paddingTop:16}, back:{fontSize:14,color:C.teal,fontWeight:'600'},
  pageTitle:{fontSize:20,fontWeight:'800',color:C.text}, pageSub:{fontSize:13,color:C.muted,marginBottom:16,marginTop:2},
  card:{backgroundColor:C.card,borderRadius:16,padding:14,marginBottom:10,shadowColor:'#0F172A',shadowOpacity:0.05,shadowRadius:8,shadowOffset:{width:0,height:2},elevation:2},
  top:{flexDirection:'row',justifyContent:'space-between',marginBottom:6}, time:{fontSize:14,fontWeight:'800',color:C.primary},
  status:{paddingHorizontal:8,paddingVertical:3,borderRadius:6}, inProg:{backgroundColor:'#DBEAFE'}, next:{backgroundColor:'#FEF3C7'}, sched:{backgroundColor:'#F1F5F9'},
  statusText:{fontSize:10,fontWeight:'800',color:C.text}, patient:{fontSize:15,fontWeight:'700',color:C.text}, proc:{fontSize:13,color:'#334155',marginTop:2},
  meta:{fontSize:12,color:C.muted,marginTop:4}, btn:{marginTop:8,backgroundColor:C.primary,borderRadius:12,paddingVertical:14,alignItems:'center'}, btnText:{color:'#FFF',fontWeight:'700',fontSize:14},
});
