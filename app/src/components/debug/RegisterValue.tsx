/** 레지스터 값 창 */
interface RegisterValueProps {
  registerData: Record<string, string>;
} 

export default function RegisterValue({ registerData }: RegisterValueProps) {
  return (
    <section className="flex flex-col px-2">
      <h2 className='text-lg font-bold'>레지스터 값</h2>
      <div className='w-full mt-2 flex flex-col gap-2'>
        {Object.entries(registerData).map(([key, value]) => (
          <div key={key} className="w-full flex justify-between items-center gap-4">
            <p className="text-base font-normal">key:</p>
            <div className="w-full h-8 rounded-xl bg-[#CB601529] flex items-center justify-end px-2">
              <p>{value}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
};