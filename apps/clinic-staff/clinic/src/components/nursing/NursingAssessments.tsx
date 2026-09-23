import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
type Props = { onBack?: () => void };
const C = { primary:'#1E3A8A', teal:'#0D9488', bg:'#F0F9FF', card:'#FFF', text:'#0F172A', muted:'#64748B' };
export const NursingAssessments: React.FC<Props> = ({ onBack }) => (
  <ScrollView style={s.wrap} showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom:28}}>
    {onBack && <TouchableOpacity onPress={onBack} style={{marginBottom:10}}><Text style={s.back}>← Back</Text></TouchableOpacity>}
    <Text style={s.pageTitle}>Nursing Assessments</Text><Text style={s.pageSub}>Pain · Fall risk · Pressure ulcer · NEWS2 · I&O</Text>
    {[
      { title:'Pain Assessment', patient:'Robert Chen · 4B', score:'6/10', time:'11:15', color:'#FEE2E2' },
      { title:'Fall Risk', patient:'Margaret Taylor · 5A', score:'High', time:'08:00', color:'#FEF3C7' },
      { title:'Pressure Ulcer Risk (Waterlow)', patient:'Margaret Taylor · 5A', score:'14 (At Risk)', time:'08:00', color:'#FEF3C7' },
      { title:'NEWS2 Full Chart', patient:'Robert Chen · 4B', score:'5 (Elevated)', time:'11:00', color:'#FEE2E2' },
      { title:'Intake & Output (24h)', patient:'Margaret Taylor · 5A', score:'In 1.2L / Out 2.8L', time:'Today', color:'#D1FAE5' },
      { title:'Wound Assessment', patient:'Aisha Okonkwo · 6C', score:'Clean, healing well', time:'09:30', color:'#D1FAE5' },
    ].map((a,i)=>(
      <TouchableOpacity key={i} style={s.card} activeOpacity={0.85}>
        <View style={[s.dot,{backgroundColor:a.color}]} />
        <View style={{flex:1}}>
          <Text style={s.title}>{a.title}</Text>
          <Text style={s.patient}>{a.patient}</Text>
          <Text style={s.score}>{a.score}</Text>
        </View>
        <Text style={s.time}>{a.time}</Text>
      </TouchableOpacity>
    ))}
    <TouchableOpacity style={s.btn}><Text style={s.btnText}>+ New Assessment</Text></TouchableOpacity>
  </ScrollView>
);
const s = StyleSheet.create({
  wrap:{flex:1,backgroundColor:C.bg,paddingHorizontal:16,paddingTop:16}, back:{fontSize:14,color:C.teal,fontWeight:'600'},
  pageTitle:{fontSize:20,fontWeight:'800',color:C.text}, pageSub:{fontSize:13,color:C.muted,marginBottom:16,marginTop:2},
  card:{flexDirection:'row',alignItems:'center',backgroundColor:C.card,borderRadius:16,padding:14,marginBottom:10,shadowColor:'#0F172A',shadowOpacity:0.05,shadowRadius:8,shadowOffset:{width:0,height:2},elevation:2},
  dot:{width:10,height:10,borderRadius:5,marginRight:12}, title:{fontSize:14,fontWeight:'700',color:C.text}, patient:{fontSize:12,color:C.muted,marginTop:2},
  score:{fontSize:13,fontWeight:'600',color:'#334155',marginTop:2}, time:{fontSize:11,color:C.muted},
  btn:{marginTop:8,backgroundColor:C.primary,borderRadius:12,paddingVertical:14,alignItems:'center'}, btnText:{color:'#FFF',fontWeight:'700',fontSize:14},
});
