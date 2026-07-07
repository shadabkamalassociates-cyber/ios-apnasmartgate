require 'xcodeproj'
project_path = 'ios/kamalSociety.xcodeproj'
project = Xcodeproj::Project.open(project_path)

target = project.targets.find { |t| t.name == 'kamalSociety' }
resources_build_phase = target.resources_build_phase

file_name = 'mygate.mp3'
file_path = "kamalSociety/#{file_name}"

unless resources_build_phase.files_references.any? { |ref| ref.path == file_name || ref.path == file_path }
  group = project.main_group.find_subpath('kamalSociety', true)
  file_reference = group.new_reference(file_name)
  resources_build_phase.add_file_reference(file_reference)
  
  project.save
  puts "Successfully added #{file_name} to project.pbxproj"
else
  puts "#{file_name} is already in the project."
end
