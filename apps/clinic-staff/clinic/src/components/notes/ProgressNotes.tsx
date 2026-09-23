import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
type Props = { onBack?: () => void };
const C = { primary:'#1E3A8A', teal:'#0D9488', bg:'#F0F9FF', card:'#FFF', text:'#0F172A', muted:'#64748B', border:'#E2E8F0' };
const NOTES = [
  { id:'1', patient:'Robert Chen', bed:'4B', author:'Dr. Thorne', time:'11:40', type:'SOAP', preview:'S: New chest pain. O: Troponin 0.84. A: Possible stent thrombosis. P: Heparin + Cardiology.' },
  { id:'2', patient:'Margaret Taylor', bed:'5A', author:'Dr. Okoro', time:'09:15', type:'Progress', preview:'Good diuresis overnight. Weight down 1.2 kg. Continue current plan.' },
  { id:'3', patient:'Aisha Okonkwo', bed:'6C', author:'Dr. Thorne', time:'08:50', type:'Post-op', preview:'Day 3 post CABG. AF rate controlled. Wound clean. Mobilising well.' },
];
export const ProgressNotes: React.FC<Props> = ({ onBack }) => {
  const [showNew, setShowNew] = useState(false);
  return (
    <ScrollView style={s.wrap} showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom:28}}>
      {onBack && <TouchableOpacity onPress={onBack} style={{marginBottom:10}}><Text style={s.back}>← Back</Text></TouchableOpacity>}
      <View style={s.head}><View><Text style={s.pageTitle}>Progress Notes</Text><Text style={s.pageSub}>Clinical documentation</Text></View>
        <TouchableOpacity style={s.newBtn} onPress={()=>setShowNew(!showNew)}><Text style={s.newBtnText}>{showNew?'Cancel':'+ Note'}</Text></TouchableOpacity></View>
      {showNew && <View style={s.newCard}>
        <TextInput style={s.input} placeholder="Patient / Bed" placeholderTextColor="#94A3B8" />
        <TextInput style={[s.input,{height:100,textAlignVertical:'top'}]} placeholder="Write progress note or SOAP..." placeholderTextColor="#94A3B8" multiline />
        <TouchableOpacity style={s.submit}><Text style={s.submitText}>Save Note</Text></TouchableOpacity>
      </View>}
      {NOTES.map(n=>(
        <View key={n.id} style={s.card}>
          <View style={s.top}><Text style={s.type}>{n.type}</Text><Text style={s.time}>{n.time}</Text></View>
          <Text style={s.patient}>{n.patient} · Bed {n.bed}</Text>
          <Text style={s.preview}>{n.preview}</Text>
          <Text style={s.author}>— {n.author}</Text>
        </View>
      ))}
    </ScrollView>
  );
};
const s = StyleSheet.create({
  wrap:{flex:1,backgroundColor:C.bg,paddingHorizontal:16,paddingTop:16}, back:{fontSize:14,color:C.teal,fontWeight:'600'},
  head:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14},
  pageTitle:{fontSize:20,fontWeight:'800',color:C.text}, pageSub:{fontSize:13,color:C.muted,marginTop:2},
  newBtn:{backgroundColor:C.primary,paddingHorizontal:14,paddingVertical:8,borderRadius:10}, newBtnText:{color:'#FFF',fontWeight:'700',fontSize:13},
  newCard:{backgroundColor:C.card,borderRadius:16,padding:16,marginBottom:16,borderWidth:1,borderColor:'#BFDBFE'},
  input:{backgroundColor:'#F8FAFC',borderWidth:1,borderColor:C.border,borderRadius:10,paddingHorizontal:12,paddingVertical:10,fontSize:14,marginBottom:10,color:C.text},
  submit:{backgroundColor:C.teal,borderRadius:10,paddingVertical:12,alignItems:'center'}, submitText:{color:'#FFF',fontWeight:'700',fontSize:14},
  card:{backgroundColor:C.card,borderRadius:16,padding:14,marginBottom:10,shadowColor:'#0F172A',shadowOpacity:0.05,shadowRadius:8,shadowOffset:{width:0,height:2},elevation:2},
  top:{flexDirection:'row',justifyContent:'space-between',marginBottom:4}, type:{fontSize:11,fontWeight:'800',color:C.teal}, time:{fontSize:12,color:C.muted},
  patient:{fontSize:14,fontWeight:'700',color:C.text}, preview:{fontSize:13,color:'#334155',marginTop:6,lineHeight:19}, author:{fontSize:12,color:C.muted,marginTop:8},
});
